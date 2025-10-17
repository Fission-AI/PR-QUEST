import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseUnifiedDiff } from "../diff-index";
import { buildHeuristicReviewPlan } from "../heuristic-steps";
import type { DiffIndex } from "../diff-index";

function loadFixture(name: string) {
  const fixturePath = resolve(process.cwd(), "tests/fixtures", name);
  return readFileSync(fixturePath, "utf8");
}

describe("buildHeuristicReviewPlan", () => {
  it("groups files by heuristics and produces deterministic steps", () => {
    const diffIndex = parseUnifiedDiff(loadFixture("heuristic-mix.diff"));
    const plan = buildHeuristicReviewPlan({ diffIndex, prTitle: "Add button styles" });

    expect(plan.steps).toHaveLength(5);

    expect(plan.steps[0]).toMatchObject({
      step_id: "step-1",
      title: "Review documentation updates",
      priority: "low",
      badges: ["Docs"],
      diff_refs: [
        {
          file_id: "docs/guide.md",
          hunk_ids: ["docs/guide.md#h0"],
        },
      ],
    });

    expect(plan.steps[1]).toMatchObject({
      step_id: "step-2",
      title: "Review test coverage adjustments",
      priority: "medium",
      badges: ["Tests"],
      diff_refs: [
        {
          file_id: "src/__tests__/user.test.ts",
          hunk_ids: ["src/__tests__/user.test.ts#h0"],
        },
      ],
    });

    expect(plan.steps[2]).toMatchObject({
      step_id: "step-3",
      title: "Review configuration updates",
      badges: ["Config"],
      diff_refs: [
        {
          file_id: "package.json",
          hunk_ids: ["package.json#h0"],
        },
      ],
    });

    expect(plan.steps[3]).toMatchObject({
      title: "Review App changes",
      diff_refs: [
        {
          file_id: "app/page.tsx",
          hunk_ids: ["app/page.tsx#h0"],
        },
      ],
    });

    expect(plan.steps[4]).toMatchObject({
      title: "Review source code changes",
      diff_refs: [
        {
          file_id: "src/components/Button.tsx",
          hunk_ids: ["src/components/Button.tsx#h0"],
        },
      ],
    });

    expect(plan.end_state.acceptance_checks).toContain("Run pnpm test to confirm coverage remains green.");
    expect(plan.end_state.risk_calls).toContain(
      "Logic changes could introduce regressions in the touched modules.",
    );
    expect(plan.pr_overview.summary).toContain("heuristic baseline groups the diff into 5 review steps");
  });

  it("caps steps to six by consolidating smaller groups", () => {
    const diffIndex: DiffIndex = {
      diff_index_version: 1,
      files: Array.from({ length: 7 }, (_, index) => {
        const prefix = `pkg${index}`;
        const fileId = `${prefix}/alpha.ts`;
        return {
          file_id: fileId,
          status: "modified" as const,
          language: "ts",
          hunks: [
            {
              hunk_id: `${fileId}#h0`,
              header: "@@ -1,1 +1,1 @@",
              old_start: 1,
              new_start: 1,
            },
          ],
        };
      }),
    };

    const plan = buildHeuristicReviewPlan({ diffIndex });

    expect(plan.steps).toHaveLength(6);
    const lastStep = plan.steps.at(-1);
    expect(lastStep?.title).toBe("Review consolidated updates");

    const consolidatedFiles = lastStep?.diff_refs.map((ref) => ref.file_id).sort();
    expect(consolidatedFiles).toEqual(["pkg5/alpha.ts", "pkg6/alpha.ts"]);
  });

  it("returns an empty review plan when no hunks are present", () => {
    const diffIndex: DiffIndex = {
      diff_index_version: 1,
      files: [],
    };

    const plan = buildHeuristicReviewPlan({ diffIndex });

    expect(plan.steps).toHaveLength(0);
    expect(plan.pr_overview.title).toBe("No diff content detected");
    expect(plan.end_state.acceptance_checks).toEqual([
      "Confirm the pull request exposes code or documentation changes.",
    ]);
  });
});
