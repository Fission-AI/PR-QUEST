import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { DiffIndex } from "../diff-index";
import type { ReviewPlan } from "../review-plan-schema";
import { buildLlmReviewPlan, type GenerateObjectFn } from "../llm-steps";

type GenerateResult = Awaited<ReturnType<GenerateObjectFn>>;

function createGenerateMock() {
  return vi.fn<Parameters<GenerateObjectFn>, ReturnType<GenerateObjectFn>>();
}

const SAMPLE_DIFF_INDEX: DiffIndex = {
  diff_index_version: 1,
  files: [
    {
      file_id: "src/components/Button.tsx",
      status: "modified",
      language: "tsx",
      hunks: [
        {
          hunk_id: "src/components/Button.tsx#h0",
          old_start: 10,
          new_start: 10,
          header: "@@ -10,6 +10,12 @@",
        },
      ],
    },
  ],
};

const BASELINE_PLAN: ReviewPlan = {
  version: 1,
  pr_overview: {
    title: "Baseline review",
    summary: "Heuristic summary acting as a baseline.",
  },
  steps: [
    {
      step_id: "step-1",
      title: "Review button styling",
      description: "Baseline step for styling.",
      objective: "Confirm updated Tailwind classes render correctly.",
      priority: "medium",
      diff_refs: [
        {
          file_id: "src/components/Button.tsx",
          hunk_ids: ["src/components/Button.tsx#h0"],
        },
      ],
      notes_suggested: [],
      badges: ["Feature"],
    },
  ],
  end_state: {
    acceptance_checks: ["Run pnpm test to ensure UI snapshots remain aligned."],
    risk_calls: ["Updated styling could regress button visibility states."],
  },
};

describe("buildLlmReviewPlan", () => {
  it("returns the baseline plan without invoking the model when no diff files exist", async () => {
    const emptyDiffIndex: DiffIndex = { diff_index_version: 1, files: [] };
    const generateMock = createGenerateMock();

    const plan = await buildLlmReviewPlan({
      diffIndex: emptyDiffIndex,
      baselinePlan: BASELINE_PLAN,
      generate: generateMock,
    });

    expect(plan).toBe(BASELINE_PLAN);
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("returns the model produced plan when generation succeeds", async () => {
    const generatedPlan: ReviewPlan = {
      ...BASELINE_PLAN,
      pr_overview: {
        title: "LLM-enhanced review",
        summary: "AI generated grouping for the button tweaks.",
      },
      steps: [
        {
          ...BASELINE_PLAN.steps[0],
          objective: "Validate the new hover state and any accessibility impacts.",
          notes_suggested: ["Double-check focus outlines in dark mode."],
        },
      ],
    };

    const generateMock = createGenerateMock();
    generateMock.mockResolvedValue({
      object: generatedPlan,
    } as GenerateResult);

    const plan = await buildLlmReviewPlan({
      diffIndex: SAMPLE_DIFF_INDEX,
      baselinePlan: BASELINE_PLAN,
      generate: generateMock,
    });

    expect(plan).toEqual(generatedPlan);
    expect(generateMock).toHaveBeenCalledTimes(1);
    const call = generateMock.mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call?.prompt).toContain("Diff index summary");
  });

  it("retries when a schema validation error is raised", async () => {
    const generatedPlan = {
      ...BASELINE_PLAN,
      pr_overview: {
        title: "LLM result after retry",
        summary: "Second attempt succeeded.",
      },
    };

    const generateMock = createGenerateMock()
      .mockRejectedValueOnce(new z.ZodError([]))
      .mockResolvedValueOnce({
        object: generatedPlan,
      } as GenerateResult);

    const plan = await buildLlmReviewPlan({
      diffIndex: SAMPLE_DIFF_INDEX,
      baselinePlan: BASELINE_PLAN,
      generate: generateMock,
      maxAttempts: 3,
    });

    expect(plan).toEqual(generatedPlan);
    expect(generateMock).toHaveBeenCalledTimes(2);
  });

  it("throws when a non-retriable error occurs", async () => {
    const error = new Error("openai is down");
    const generateMock = createGenerateMock().mockRejectedValue(error);

    await expect(
      buildLlmReviewPlan({
        diffIndex: SAMPLE_DIFF_INDEX,
        baselinePlan: BASELINE_PLAN,
        generate: generateMock,
        maxAttempts: 2,
      }),
    ).rejects.toBe(error);

    expect(generateMock).toHaveBeenCalledTimes(1);
  });
});
