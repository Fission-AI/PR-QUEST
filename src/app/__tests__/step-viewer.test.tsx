import { fireEvent, render, screen, within } from "@testing-library/react";
import { StepViewer } from "../step-viewer";
import type { ReviewPlan } from "@/lib/review-plan-schema";

function buildFixturePlan(): ReviewPlan {
  return {
    version: 1,
    pr_overview: {
      title: "Test Review Plan",
      summary: "Covers a simple modification with one hunk.",
    },
    steps: [
      {
        step_id: "step-1",
        title: "Inspect src/foo.ts changes",
        description: "Validate updated values in foo module.",
        objective: "Confirm behavior remains correct.",
        priority: "high",
        diff_refs: [
          {
            file_id: "src/foo.ts",
            hunk_ids: ["src/foo.ts#h0"],
          },
        ],
        notes_suggested: [],
        badges: ["Code"],
      },
      {
        step_id: "step-2",
        title: "Review missing file reference",
        description: "This step references a file not present in the diff.",
        objective: "Ensure UI handles missing references gracefully.",
        priority: "low",
        diff_refs: [
          {
            file_id: "src/missing.ts",
            hunk_ids: ["src/missing.ts#h0"],
          },
        ],
        notes_suggested: [],
        badges: ["Docs"],
      },
    ],
    end_state: {
      acceptance_checks: ["All tests pass"],
      risk_calls: ["Potential regressions in foo module"],
    },
  };
}

// Minimal unified diff with a single hunk in src/foo.ts
const DIFF_TEXT = [
  "diff --git a/src/foo.ts b/src/foo.ts",
  "index 1111111..2222222 100644",
  "--- a/src/foo.ts",
  "+++ b/src/foo.ts",
  "@@ -1,2 +1,3 @@",
  "-const a = 1;",
  "+const a = 2;",
  "+const b = 3;",
  "",
].join("\n");

describe("StepViewer", () => {
  it("renders overview, rail, and filtered diff for the active step", () => {
    const plan = buildFixturePlan();
    render(<StepViewer plan={plan} diffText={DIFF_TEXT} />);

    expect(
      screen.getByRole("heading", { level: 2, name: /test review plan/i }),
    ).toBeVisible();
    expect(screen.getByText(/simple modification/i)).toBeInTheDocument();

    // Left rail: has a list with two items
    const rail = screen.getByRole("complementary", { name: /review steps/i });
    const list = within(rail).getByRole("list");
    expect(within(list).getAllByRole("listitem").length).toBe(2);

    // Progress indicator for first step
    expect(screen.getByText(/step 1 of 2/i)).toBeInTheDocument();

    // Active step header shows the step title
    expect(
      screen.getByRole("heading", { level: 3, name: /inspect src\/foo\.ts changes/i }),
    ).toBeInTheDocument();

    // Diff card shows file and change type
    expect(screen.getByText("src/foo.ts")).toBeInTheDocument();
    expect(screen.getByText(/change:\s*\w+/i)).toBeInTheDocument();
  });

  it("switches steps from rail and shows missing-file message when refs are absent", () => {
    const plan = buildFixturePlan();
    render(<StepViewer plan={plan} diffText={DIFF_TEXT} />);

    const step2Button = screen.getByRole("button", { name: /step 2/i });
    fireEvent.click(step2Button);

    expect(screen.getByText(/step 2 of 2/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: /review missing file reference/i }),
    ).toBeInTheDocument();

    // Missing file message should appear for the referenced file not present in the diff
    expect(
      screen.getByText(/unable to locate the diff hunks referenced for this file/i),
    ).toBeInTheDocument();
  });
});


