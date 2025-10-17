"use client";

import React from "react";
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
  
  const [focusMode, setFocusMode] = useState(false);
  const [viewType, setViewType] = useState<"split" | "unified">("split");
  
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

  useEffect(() => {
    const savedFocus = typeof window !== "undefined" ? window.localStorage.getItem("pq_focus") : null;
    const savedView = typeof window !== "undefined" ? window.localStorage.getItem("pq_view") : null;
    if (savedFocus) setFocusMode(savedFocus === "1");
    if (savedView === "unified" || savedView === "split") setViewType(savedView);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("pq_focus", focusMode ? "1" : "0");
  }, [focusMode]);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("pq_view", viewType);
  }, [viewType]);

  // keyboard shortcuts: F focus, u unified, s split, n/p next/prev step
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      if (e.key === "F" || e.key === "f") {
        e.preventDefault();
        setFocusMode((v) => !v);
        return;
      }
      if (e.key === "u" || e.key === "U") {
        e.preventDefault();
        setViewType("unified");
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        setViewType("split");
        return;
      }
      if (e.key === "n") {
        e.preventDefault();
        handleStepChange(activeIndex + 1);
        return;
      }
      if (e.key === "p") {
        e.preventDefault();
        handleStepChange(activeIndex - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex]);

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

  const progressValue = currentIndex + 1;
  const totalSteps = steps.length;
  const progressPercent = totalSteps > 0 ? Math.max(0, Math.min(1, progressValue / totalSteps)) * 100 : 0;

  return (
    <>
      {/* PR Overview Box - Above main panel */}
      <header className="step-viewer__overview pixel-panel" aria-labelledby="pr-overview-title">
        <div className="step-viewer__overview-header">
          <h2 id="pr-overview-title" className="pixel-heading step-viewer__overview-title">
            {plan.pr_overview.title}
          </h2>
          <button 
            type="button" 
            className="pixel-button" 
            onClick={() => setFocusMode((v) => !v)} 
            aria-pressed={focusMode}
            title="Toggle focus mode (F key)"
          >
            {focusMode ? "Exit Focus" : "Focus"}
          </button>
        </div>
        <p className="step-viewer__overview-summary">{plan.pr_overview.summary}</p>
        
        {/* Steps Summary */}
        <div className="step-viewer__overview-steps">
          <h3 className="pixel-heading step-viewer__overview-steps-title">
            Review Overview
          </h3>
          <div className="step-viewer__overview-steps-grid">
            {steps.map((step, index) => (
              <div key={step.step_id} className="step-viewer__overview-step-item">
                <span className="step-viewer__overview-step-number">Step {index + 1}</span>
                <span className="step-viewer__overview-step-title">{step.title}</span>
                <span className="step-viewer__overview-step-priority pixel-badge pixel-badge--small">
                  {step.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Step Navigation - Between overview panel and main viewer */}
      <nav className="step-viewer__bottom-nav pixel-panel" aria-label="Step navigation">
        <button
          type="button"
          className="pixel-button"
          onClick={() => handleStepChange(currentIndex - 1)}
          disabled={currentIndex <= 0}
          aria-disabled={currentIndex <= 0}
        >
          ← Previous Step
        </button>
        <div className="step-viewer__bottom-nav-center">
          <span className="pixel-stat">{currentIndex + 1} of {totalSteps}</span>
        </div>
        <button
          type="button"
          className="pixel-button"
          onClick={() => handleStepChange(currentIndex + 1)}
          disabled={currentIndex >= totalSteps - 1}
          aria-disabled={currentIndex >= totalSteps - 1}
        >
          Next Step →
        </button>
      </nav>

      <section className={`step-viewer pixel-panel${focusMode ? " step-viewer--focus" : ""}`} aria-labelledby="step-viewer-title">
      {/* Main Toolbar */}
      <div className="step-viewer__toolbar" role="toolbar" aria-label="Review toolbar">
        <div className="step-viewer__toolbar-left">
        </div>

        <div className="step-viewer__toolbar-center">
          <div className="step-viewer__shortcuts-hint" title="Keyboard shortcuts: F=Focus, U/S=View, N/P=Next/Prev">
            ⌨️ Shortcuts: F=Focus, U/S=View, N/P=Next/Prev
          </div>
        </div>

        <div className="step-viewer__toolbar-right">
          <button type="button" className="pixel-button" onClick={() => setViewType((v) => (v === "split" ? "unified" : "split"))}>
            {viewType === "split" ? "Unified" : "Split"}
          </button>
        </div>
      </div>

      <kbd className="sr-only" aria-hidden>shortcuts active</kbd>

      <div className="step-viewer__body">
        <div className="step-viewer__main" aria-live="polite">
          {activeStep ? (
            <>
              {/* Current Step Card */}
              <article className="step-viewer__current-step-card" id={`step-${activeStep?.step_id}`}>
                <header className="step-viewer__current-header">
                  <div className="step-viewer__current-meta">
                    <span className="pixel-stat step-viewer__current-number">Step {currentIndex + 1}</span>
                    <span className="step-viewer__current-priority pixel-badge pixel-badge--small">{activeStep.priority}</span>
                  </div>
                  <h3 className="step-viewer__current-title">{activeStep.title}</h3>
                  <p className="step-viewer__current-description">
                    {activeStep.description}
                  </p>
                </header>
                
                <div className="step-viewer__current-content">
                  <div className="step-viewer__objective">
                    <h4 className="step-viewer__objective-heading">Objective</h4>
                    <p>{activeStep.objective}</p>
                  </div>
                  
                  {activeStep.badges.length > 0 && (
                    <div className="step-viewer__badges">
                      {activeStep.badges.map((badge) => (
                        <span key={badge} className="pixel-badge pixel-badge--small">
                          {badge}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>

              

              {/* Diff Changes Card */}
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
                        <div>
                          {entry.hunks.map((hunk, hIndex) => {
                            const anchorId = `${entry.file.fileId}__${hunk.oldStart}_${hunk.newStart}_${hIndex}`;
                            
                            return (
                              <details key={anchorId} id={anchorId} open>
                                <summary>
                                  Hunk at old:{hunk.oldStart} new:{hunk.newStart}
                                </summary>
                                <Diff diffType={entry.file.diffType} hunks={[hunk]} viewType={viewType} className="step-viewer__diff">
                                  {(renderHunks) => renderHunks.map((inner, i) => <Hunk key={`${anchorId}-inner-${i}`} hunk={inner} />)}
                                </Diff>
                              </details>
                            );
                          })}
                        </div>
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
            </>
          ) : (
            <p className="text-muted-brown">Select a step from the left to view its details.</p>
          )}
        </div>
      </div>
    </section>

      {/* Bottom Navigation - Below the main viewer */}
      <nav className="step-viewer__bottom-nav pixel-panel" aria-label="Step navigation">
        <button
          type="button"
          className="pixel-button"
          onClick={() => handleStepChange(currentIndex - 1)}
          disabled={currentIndex <= 0}
          aria-disabled={currentIndex <= 0}
        >
          ← Previous Step
        </button>
        <div className="step-viewer__bottom-nav-center">
          <span className="pixel-stat">{currentIndex + 1} of {totalSteps}</span>
        </div>
        <button
          type="button"
          className="pixel-button"
          onClick={() => handleStepChange(currentIndex + 1)}
          disabled={currentIndex >= totalSteps - 1}
          aria-disabled={currentIndex >= totalSteps - 1}
        >
          Next Step →
        </button>
      </nav>

    
    </>
  );
}
