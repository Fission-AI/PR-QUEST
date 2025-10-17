import { openai } from "@ai-sdk/openai";
import { generateObject, NoObjectGeneratedError } from "ai";
import { z } from "zod";

import type { DiffIndex } from "./diff-index";
import { buildHeuristicReviewPlan } from "./heuristic-steps";
import type { GroupingMetadata } from "./grouping-schemas";
import { ReviewPlanSchema, type ReviewPlan } from "./review-plan-schema";
import { debugLog } from "./debug";

const DEFAULT_MODEL = process.env.NEXT_PUBLIC_PR_QUEST_LLM_MODEL ?? process.env.OPENAI_REVIEW_MODEL ?? "gpt-4o-mini";
const MAX_ATTEMPTS = 3;
const MAX_FILES_IN_PROMPT = 24;
const MAX_HUNKS_PER_FILE_IN_PROMPT = 6;

export type GenerateObjectFn = typeof generateObject;

const defaultGenerateObject: GenerateObjectFn = generateObject;

const SYSTEM_PROMPT = [
  "You are PR Quest, an AI assistant that helps engineers review pull requests.",
  "Given a diff index and optional metadata, produce a JSON review plan that matches the provided schema.",
  "Prioritise clarity, keep instructions concise, and ground every reference in the supplied diff ids.",
].join(" ");

interface BuildPromptOptions {
  diffIndex: DiffIndex;
  metadata: GroupingMetadata;
  baselinePlan: ReviewPlan;
}

interface BuildLlmReviewPlanOptions {
  diffIndex: DiffIndex;
  metadata?: GroupingMetadata;
  baselinePlan?: ReviewPlan;
  generate?: GenerateObjectFn;
  model?: string;
  maxAttempts?: number;
}

export async function buildLlmReviewPlan({
  diffIndex,
  metadata,
  baselinePlan,
  generate = defaultGenerateObject,
  model = DEFAULT_MODEL,
  maxAttempts = MAX_ATTEMPTS,
}: BuildLlmReviewPlanOptions): Promise<ReviewPlan> {
  debugLog("llm-steps", "begin buildLlmReviewPlan", {
    files: diffIndex.files.length,
    hasBaseline: Boolean(baselinePlan),
    model,
    openaiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
    maxAttempts,
  });
  const normalizedMetadata = metadata ?? {};
  const referencePlan =
    baselinePlan ??
    buildHeuristicReviewPlan({
      diffIndex,
      prTitle: normalizedMetadata.prTitle,
      prDescription: normalizedMetadata.prDescription,
    });

  if (diffIndex.files.length === 0) {
    return referencePlan;
  }

  const prompt = buildPrompt({
    diffIndex,
    metadata: normalizedMetadata,
    baselinePlan: referencePlan,
  });

  let lastError: unknown = null;

  for (let attempt = 0; attempt < Math.max(1, maxAttempts); attempt += 1) {
    try {
      debugLog("llm-steps", "attempt generate", { attempt: attempt + 1 });
      const result = await generate({
        model: openai(model),
        schema: ReviewPlanSchema,
        system: SYSTEM_PROMPT,
        prompt,
        temperature: 0.2,
        maxRetries: 0,
      });
      debugLog("llm-steps", "generate success", { attempt: attempt + 1 });
      return ReviewPlanSchema.parse(result.object);
    } catch (error) {
      lastError = error;
      debugLog("llm-steps", "generate error", { attempt: attempt + 1, error: error instanceof Error ? error.message : String(error) });
      const shouldRetry = isSchemaMismatchError(error) && attempt < Math.max(1, maxAttempts) - 1;

      if (!shouldRetry) {
        throw error;
      }
    }
  }

  if (lastError instanceof Error) {
    debugLog("llm-steps", "throwing last error", { message: lastError.message });
    throw lastError;
  }

  throw new Error("LLM grouping failed without a specific error.");
}

export type { BuildLlmReviewPlanOptions };
function isSchemaMismatchError(error: unknown) {
  if (error instanceof z.ZodError) {
    return true;
  }

  return NoObjectGeneratedError.isInstance(error);
}

function buildPrompt({ diffIndex, metadata, baselinePlan }: BuildPromptOptions) {
  const headerSections = [
    metadata.prTitle ? `Pull request title: ${metadata.prTitle}` : "Pull request title: (not provided)",
  ];

  if (metadata.prDescription) {
    headerSections.push(`Pull request summary:\n${metadata.prDescription}`);
  }

  const diffSummary = summariseDiffIndex(diffIndex);
  const heuristicSummary = summariseBaselinePlan(baselinePlan);

  const instructions = [
    "Requirements:",
    "- Produce between 2 and 6 steps when there are files to review. Use sequential step_ids: step-1, step-2, …. ",
    "- Keep step titles/objectives actionable; mention the intent of the referenced changes.",
    "- diff_refs must reference only the provided file_id and hunk_ids.",
    "- Populate notes_suggested with reviewer tips when appropriate; otherwise leave it empty.",
    "- Use badges to highlight categories like Docs, Tests, Config, Feature, Performance, etc. Leave empty array if none apply.",
    "- Set version to 1 and provide concise pr_overview.summary (<=2 sentences).",
    "- end_state.acceptance_checks should contain 2-3 validations. end_state.risk_calls should mention the most important risks.",
  ].join("\n");

  return [
    headerSections.join("\n\n"),
    "Diff index summary:",
    diffSummary,
    "Heuristic baseline (for context):",
    heuristicSummary,
    instructions,
  ].join("\n\n");
}

function summariseDiffIndex(diffIndex: DiffIndex) {
  if (diffIndex.files.length === 0) {
    return "(no diff files)";
  }

  const limitedFiles = diffIndex.files.slice(0, MAX_FILES_IN_PROMPT);
  const fileSummaries = limitedFiles.map((file) => {
    const languageLabel = file.language ? `, lang: ${file.language}` : "";
    const hunkSummary = summariseHunks(file.hunks);

    return [
      `- file_id: ${file.file_id} [status: ${file.status}${languageLabel}]`,
      "  hunks:",
      hunkSummary,
    ].join("\n");
  });

  if (diffIndex.files.length > limitedFiles.length) {
    fileSummaries.push(`- ... +${diffIndex.files.length - limitedFiles.length} more files omitted for brevity.`);
  }

  return fileSummaries.join("\n");
}

function summariseHunks(hunks: DiffIndex["files"][number]["hunks"]) {
  if (hunks.length === 0) {
    return "    - (no parsed hunks)";
  }

  const limitedHunks = hunks.slice(0, MAX_HUNKS_PER_FILE_IN_PROMPT);
  const lines = limitedHunks.map((hunk) => `    - ${hunk.hunk_id}: ${hunk.header}`);

  if (hunks.length > limitedHunks.length) {
    lines.push(`    - ... +${hunks.length - limitedHunks.length} more hunks omitted.`);
  }

  return lines.join("\n");
}

function summariseBaselinePlan(plan: ReviewPlan) {
  if (plan.steps.length === 0) {
    return "Heuristic planner found no review steps (likely because the diff was empty).";
  }

  return plan.steps
    .map((step) => {
      const refs = step.diff_refs
        .map((ref) => `${ref.file_id} [${ref.hunk_ids.join(", ")}]`)
        .join("; ");

      return `- ${step.step_id}: ${step.title} → ${refs}`;
    })
    .join("\n");
}
