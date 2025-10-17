import { NextResponse } from "next/server";

import { GroupingRequestSchema } from "@/lib/grouping-schemas";
import { buildHeuristicReviewPlan } from "@/lib/heuristic-steps";
import { buildLlmReviewPlan } from "@/lib/llm-steps";
import { debugLog, startDebugTimer } from "@/lib/debug";

const GROUPING_MODE_HEADER = "x-pr-quest-grouping-mode";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function successResponse(plan: unknown, mode: string) {
  return NextResponse.json(plan, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      [GROUPING_MODE_HEADER]: mode,
    },
  });
}

export async function POST(request: Request) {
  const t = startDebugTimer("api-group", "POST /api/group");
  let payload: unknown;

  try {
    payload = await request.json();
  } catch (error) {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const parsed = GroupingRequestSchema.safeParse(payload);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues.at(0);
    const path = firstIssue?.path.join(".") || "request";
    const message = firstIssue?.message ?? "Invalid grouping request payload.";

    return errorResponse(`${path}: ${message}`, 400);
  }

  const { diffIndex, metadata } = parsed.data;
  debugLog("api-group", "payload accepted", {
    files: diffIndex.files.length,
    metaTitle: metadata?.prTitle,
  });
  const model = process.env.NEXT_PUBLIC_PR_QUEST_LLM_MODEL ?? process.env.OPENAI_REVIEW_MODEL ?? "gpt-4o-mini";
  debugLog("api-group", "llm gating (forced)", {
    diffFiles: diffIndex.files.length,
    openaiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
    model,
  });
  const heuristicPlan = buildHeuristicReviewPlan({
    diffIndex,
    prTitle: metadata.prTitle,
    prDescription: metadata.prDescription,
  });

  if (diffIndex.files.length === 0) {
    return NextResponse.json(
      { error: "No reviewable diff content." },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
          [GROUPING_MODE_HEADER]: "llm-error",
        },
      },
    );
  }

  try {
    const llmPlan = await buildLlmReviewPlan({
      diffIndex,
      metadata,
      baselinePlan: heuristicPlan,
    });
    debugLog("api-group", "returning llm plan", { steps: llmPlan.steps.length });
    return successResponse(llmPlan, "llm");
  } catch (error) {
    console.error("LLM grouping failed; refusing heuristic fallback (LLM-only mode)", error);
    return NextResponse.json(
      { error: "LLM grouping failed. Try again later.", detail: error instanceof Error ? error.message : String(error) },
      {
        status: 502,
        headers: {
          "Cache-Control": "no-store",
          [GROUPING_MODE_HEADER]: "llm-error",
        },
      },
    );
  }
}
