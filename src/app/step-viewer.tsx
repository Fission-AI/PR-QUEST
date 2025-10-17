"use client";

import { useEffect, useMemo, useState } from "react";
import { Diff, Hunk, parseDiff, type DiffType } from "react-diff-view";
import type { FileData, HunkData } from "react-diff-view";

import type { ReviewPlan } from "@/lib/review-plan-schema";
import { debugLog, isDebugEnabled } from "@/lib/debug";

// styles are imported globally from layout.tsx

type StepViewerProps = {
  plan: ReviewPlan;
  diffText: string;
  initialStepIndex?: number;
  onStepChange?: (index: number) => void;
};

type DiffHunkEntry = {
  id: string;
  hunk: HunkData;
};

type DiffFileEntry = {
  fileId: string;
  label: string;
  diffType: DiffType;
  hunks: DiffHunkEntry[];
  hunkMap: Map<string, DiffHunkEntry>;
};

type StepFileDisplay =
  | {
      status: "ready";
      file: DiffFileEntry;
      hunks: HunkData[];
      missingHunks: string[];
    }
  | {
      status: "missing-file";
      fileId: string;
      missingHunks: string[];
    };

function resolveFileId(file: FileData) {
  if (file.type === "delete") {
    return file.oldPath ?? file.newPath ?? null;
  }

  if (file.type === "rename" || file.type === "copy") {
    return file.newPath ?? file.oldPath ?? null;
  }

  return file.newPath ?? file.oldPath ?? null;
}

function buildDiffLookup(diffText: string) {
  let files: FileData[] = [];
  try {
    files = parseDiff(diffText, { nearbySequences: "zip" });
  } catch {
    files = [];
  }
  const lookup = new Map<string, DiffFileEntry>();

  for (const file of files) {
    const fileId = resolveFileId(file);
    if (!fileId) {
      continue;
    }

    const hunks = file.hunks.map((hunk, index) => {
      const id = `${fileId}#h${index}`;
      return { id, hunk };
    });

    lookup.set(fileId, {
      fileId,
      label: fileId,
      diffType: file.type as DiffType,
      hunks,
      hunkMap: new Map(hunks.map((entry) => [entry.id, entry])),
    });
  }

  return lookup;
}

export function StepViewer({ plan, diffText, initialStepIndex, onStepChange }: StepViewerProps) {
  const steps = plan.steps;
  const [activeIndex, setActiveIndex] = useState(0);
  const stepKey = useMemo(
    () => steps.map((step) => step.step_id).join("|"),
    [steps],
  );

  useEffect(() => {
    const clamped = Math.max(0, Math.min(typeof initialStepIndex === "number" ? initialStepIndex : 0, Math.max(steps.length - 1, 0)));
    setActiveIndex(clamped);
  }, [stepKey, initialStepIndex, steps.length]);

  const handleStepChange = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(nextIndex, Math.max(steps.length - 1, 0)));
    setActiveIndex(clamped);
    if (onStepChange) {
      onStepChange(clamped);
    }
  };

  const diffLookup = useMemo(() => buildDiffLookup(diffText), [diffText]);

  if (isDebugEnabled("step-viewer")) {
    debugLog("step-viewer", "render", {
      steps: steps.length,
      activeIndex,
      diffFiles: diffLookup.size,
    });
  }

  if (steps.length === 0) {
    return (
      <section className="step-viewer pixel-panel" aria-labelledby="step-viewer-title">
        <header className="step-viewer__header">
          <h2 id="step-viewer-title" className="pixel-heading step-viewer__title">
            Review walkthrough
          </h2>
          <p className="step-viewer__summary text-muted-brown">
            No review steps were generated for this diff.
          </p>
        </header>
      </section>
    );
  }

  const currentIndex = steps.length > 0 ? Math.min(activeIndex, steps.length - 1) : -1;
  const activeStep = currentIndex >= 0 ? steps[currentIndex] : null;

  const stepFiles: StepFileDisplay[] = useMemo(() => {
    if (!activeStep) {
      return [];
    }

    return activeStep.diff_refs.map((ref) => {
      const file = diffLookup.get(ref.file_id);
      if (!file) {
        debugLog("step-viewer", "missing file for step ref", { fileId: ref.file_id });
        return {
          status: "missing-file" as const,
          fileId: ref.file_id,
          missingHunks: ref.hunk_ids,
        };
      }

      const matched = ref.hunk_ids
        .map((id) => file.hunkMap.get(id))
        .filter((entry): entry is DiffHunkEntry => Boolean(entry));
      const missingHunks = ref.hunk_ids.filter((id) => !file.hunkMap.has(id));

      if (missingHunks.length > 0) {
        debugLog("step-viewer", "missing hunks for file", { fileId: file.fileId, missing: missingHunks.length });
      }

      return {
        status: "ready" as const,
        file,
        hunks: matched.map((entry) => entry.hunk),
        missingHunks,
      };
    });
  }, [activeStep, diffLookup]);

  const progressValue = currentIndex + 1;
  const totalSteps = steps.length;
  const progressPercent = totalSteps > 0 ? Math.max(0, Math.min(1, progressValue / totalSteps)) * 100 : 0;

  return (
    <section className="step-viewer pixel-panel" aria-labelledby="step-viewer-title">
      <header className="step-viewer__header">
        <h2 id="step-viewer-title" className="pixel-heading step-viewer__title">
          {plan.pr_overview.title}
        </h2>
        <p className="step-viewer__summary text-muted-brown">{plan.pr_overview.summary}</p>
      </header>
      <div className="step-viewer__body">
        <aside className="step-viewer__rail" aria-label="Review steps">
          <div className="step-viewer__progress">
            <span className="pixel-stat">Progress</span>
            <div
              className="pixel-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={totalSteps}
              aria-valuenow={progressValue}
              aria-valuetext={`Step ${progressValue} of ${totalSteps}`}
            >
              <div className="pixel-progress__bar" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="step-viewer__progress-label text-muted-brown">
              Step {progressValue} of {totalSteps}
            </p>
          </div>
          <ol className="step-viewer__list">
            {steps.map((step, index) => {
              const isActive = index === currentIndex;
              return (
                <li key={step.step_id}>
                  <button
                    type="button"
                    className={`step-viewer__step-button${isActive ? " step-viewer__step-button--active" : ""}`}
                    onClick={() => handleStepChange(index)}
                    aria-current={isActive ? "step" : undefined}
                  >
                    <span className="step-viewer__step-number">Step {index + 1}</span>
                    <span className="step-viewer__step-title">{step.title}</span>
                    <span className="step-viewer__step-priority text-muted-brown">
                      Priority: {step.priority}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
        <div className="step-viewer__main" aria-live="polite">
          {activeStep ? (
            <>
              <header className="step-viewer__active-header">
                <p className="pixel-stat">Currently viewing</p>
                <h3 className="step-viewer__active-title">{activeStep.title}</h3>
                <p className="step-viewer__active-description text-muted-brown">
                  {activeStep.description}
                </p>
                <div className="step-viewer__objective">
                  <h4 className="step-viewer__objective-heading">Objective</h4>
                  <p>{activeStep.objective}</p>
                </div>
                {activeStep.badges.length > 0 ? (
                  <div className="step-viewer__badges">
                    {activeStep.badges.map((badge) => (
                      <span key={badge} className="pixel-badge">
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}
              </header>
              <div className="step-viewer__diffs">
                {stepFiles.map((entry, index) => {
                  if (entry.status === "missing-file") {
                    return (
                      <article key={`${entry.fileId}-${index}`} className="step-viewer__diff-card">
                        <header className="step-viewer__diff-header">
                          <h4 className="step-viewer__diff-title">{entry.fileId}</h4>
                        </header>
                        <p className="step-viewer__diff-missing text-muted-brown">
                          Unable to locate the diff hunks referenced for this file.
                        </p>
                      </article>
                    );
                  }

                  return (
                    <article key={`${entry.file.fileId}-${index}`} className="step-viewer__diff-card">
                      <header className="step-viewer__diff-header">
                        <h4 className="step-viewer__diff-title">{entry.file.label}</h4>
                        <span className="step-viewer__diff-type pixel-stat">Change: {entry.file.diffType}</span>
                      </header>
                      {entry.hunks.length > 0 ? (
                        <Diff diffType={entry.file.diffType} hunks={entry.hunks} viewType="split" className="step-viewer__diff">
                          {(hunksToRender) =>
                            hunksToRender.map((hunk) => (
                              <Hunk key={hunk.content} hunk={hunk} />
                            ))
                          }
                        </Diff>
                      ) : (
                        <p className="step-viewer__diff-missing text-muted-brown">
                          Diff hunks were referenced but could not be found.
                        </p>
                      )}
                      {entry.missingHunks.length > 0 ? (
                        <p className="step-viewer__diff-missing text-muted-brown">
                          Missing hunks: {entry.missingHunks.join(", ")}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
              <nav className="step-viewer__nav" aria-label="Step navigation">
                <button
                  type="button"
                  className="pixel-button"
                  onClick={() => handleStepChange(currentIndex - 1)}
                  disabled={currentIndex <= 0}
                  aria-disabled={currentIndex <= 0}
                >
                  ← Back
                </button>
                <span className="step-viewer__nav-spacer" aria-hidden />
                <button
                  type="button"
                  className="pixel-button"
                  onClick={() => handleStepChange(currentIndex + 1)}
                  disabled={currentIndex >= totalSteps - 1}
                  aria-disabled={currentIndex >= totalSteps - 1}
                >
                  Next →
                </button>
              </nav>
            </>
          ) : (
            <p className="text-muted-brown">Select a step from the left to view its details.</p>
          )}
        </div>
      </div>
    </section>
  );
}
