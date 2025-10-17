"use server";

import { POST as groupRoute } from "@/app/api/group/route";
import { GET as diffRoute } from "@/app/api/diff/route";
import { parseUnifiedDiff } from "@/lib/diff-index";
import { GroupingRequestSchema } from "@/lib/grouping-schemas";
import { parseGitHubPrUrl, type ParsedGitHubPrUrl } from "@/lib/pr-url";
import { ReviewPlanSchema, type ReviewPlan } from "@/lib/review-plan-schema";
import { debugLog, startDebugTimer } from "@/lib/debug";

type GroupingMode = "heuristic" | "llm" | "llm-fallback";

export interface PrValidationState {
  status: "idle" | "success" | "error";
  message?: string;
  result?: ParsedGitHubPrUrl & {
    reviewPlan: ReviewPlan;
    groupingMode: GroupingMode;
    diffText: string;
  };
}

export async function validatePrAction(
  _prevState: PrValidationState,
  formData: FormData,
): Promise<PrValidationState> {
  const t = startDebugTimer("validate-pr", "validatePrAction");
  const rawUrl = formData.get("prUrl");

  if (typeof rawUrl !== "string") {
    return { status: "error", message: "Enter a GitHub pull request URL." };
  }

  const parsed = parseGitHubPrUrl(rawUrl);
  debugLog("validate-pr", "parsed PR URL", { ok: parsed.ok });

  if (!parsed.ok) {
    return { status: "error", message: parsed.error };
  }

  const prDetails = parsed.value;

  debugLog("validate-pr", "requesting diff");
  const diffResponse = await diffRoute(
    new Request(createInternalUrl(`/api/diff?prUrl=${encodeURIComponent(prDetails.htmlUrl)}`)),
  );

  if (!diffResponse.ok) {
    const errorMessage = await extractErrorMessage(diffResponse);
    return { status: "error", message: errorMessage ?? "Unable to download the pull request diff. Try again later." };
  }

  const diffText = await diffResponse.text();
  debugLog("validate-pr", "diff fetched", { bytes: new TextEncoder().encode(diffText).length });
  const diffIndex = parseUnifiedDiff(diffText);
  debugLog("validate-pr", "diff index built", { files: diffIndex.files.length });

  const groupingInput = GroupingRequestSchema.parse({
    diffIndex,
    metadata: {
      prTitle: buildFallbackTitle(prDetails),
    },
  });

  debugLog("validate-pr", "requesting grouping");
  const groupResponse = await groupRoute(
    new Request(createInternalUrl("/api/group"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(groupingInput),
    }),
  );

  if (!groupResponse.ok) {
    const errorMessage = await extractErrorMessage(groupResponse);
    return { status: "error", message: errorMessage ?? "Grouping failed. Please try again." };
  }

  const groupingMode = normalizeGroupingMode(groupResponse.headers.get("x-pr-quest-grouping-mode"));
  debugLog("validate-pr", "received grouping mode", { groupingMode });
  const planJson = await groupResponse.json();
  const reviewPlan = ReviewPlanSchema.parse(planJson);
  debugLog("validate-pr", "grouping complete", { mode: groupingMode, steps: reviewPlan.steps.length });

  return {
    status: "success",
    result: {
      ...prDetails,
      reviewPlan,
      groupingMode,
      diffText,
    },
  };
  // end timer includes summary
  t.end({ mode: groupingMode });
}

function createInternalUrl(path: string) {
  const origin = process.env.PR_QUEST_INTERNAL_ORIGIN ?? "http://localhost:3000";
  return new URL(path, origin).toString();
}

async function extractErrorMessage(response: Response) {
  try {
    const data = await response.json();
    if (typeof data === "object" && data && "error" in data && typeof data.error === "string") {
      return data.error;
    }
  } catch {
    // ignore parsing issues; we only surface structured errors
  }

  return null;
}

function buildFallbackTitle(details: ParsedGitHubPrUrl) {
  return `${details.owner}/${details.repo} PR #${details.prNumber}`;
}

function normalizeGroupingMode(value: string | null): GroupingMode {
  if (value === "llm" || value === "llm-fallback") {
    return value;
  }

  return "heuristic";
}
