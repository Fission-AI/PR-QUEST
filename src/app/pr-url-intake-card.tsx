"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";

import { parseGitHubPrUrl } from "@/lib/pr-url";
import { validatePrAction, type PrValidationState } from "./actions/validate-pr";
import { debugLog, isDebugEnabled } from "@/lib/debug";

const initialState: PrValidationState = { status: "idle" };

type PrUrlIntakeCardProps = {
  id?: string;
};

function AnalyzeButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="pixel-button hero__cta-button" aria-disabled={!enabled || pending} disabled={!enabled || pending}>
      {pending ? "Analyzing…" : "Begin your quest →"}
    </button>
  );
}

export function PrUrlIntakeCard({ id }: PrUrlIntakeCardProps) {
  const [inputValue, setInputValue] = useState("");
  const [state, formAction] = useActionState(validatePrAction, initialState);
  const [analyzing, setAnalyzing] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const clientParse = useMemo(() => {
    if (!inputValue.trim()) {
      return { ok: false as const, error: "Enter a GitHub pull request URL." };
    }

    return parseGitHubPrUrl(inputValue);
  }, [inputValue]);

  const isClientValid = clientParse.ok;

  if (isDebugEnabled("intake")) {
    debugLog("intake", "render", {
      status: state.status,
      valid: isClientValid,
      input: inputValue,
    });
  }

  const diffPreview =
    state.status === "success"
      ? state.result?.diffUrl
      : clientParse.ok
        ? clientParse.value.diffUrl
        : null;

  const helperText = (() => {
    if (state.status === "error") {
      return state.message;
    }

    if (analyzing) {
      return "Analyzing pull request… This can take a few seconds.";
    }

    return clientParse.ok ? "Looks good — ready to analyze this pull request." : "Paste a public GitHub PR URL to begin.";
  })();

  const initialStepIndex = useMemo(() => {
    const raw = searchParams.get("step");
    const n = raw ? Number(raw) : 0;
    if (!Number.isFinite(n) || n < 0) return 0;
    const stepCount = state.status === "success" && state.result ? state.result.reviewPlan.steps.length : 0;
    if (stepCount <= 0) return 0;
    return Math.min(n, stepCount - 1);
  }, [searchParams, state.status, state.result]);

  const handleStepChange = (index: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", String(index));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Redirect to /review on success after commit to avoid updating during render
  const hasNavigatedRef = useRef(false);
  useEffect(() => {
    if (hasNavigatedRef.current) return;
    if (state.status === "success" && state.result) {
      hasNavigatedRef.current = true;
      const prUrl = state.result.htmlUrl;
      const params = new URLSearchParams(searchParams.toString());
      params.set("prUrl", prUrl);
      params.set("step", "0");
      router.push(`/review?${params.toString()}`);
    }
  }, [state.status, state.result, router, searchParams]);

  // Clear analyzing overlay on error or when input changes after an error
  useEffect(() => {
    if (state.status === "error") {
      setAnalyzing(false);
    }
  }, [state.status]);

  return (
    <>
      <section id={id} className="quest-card" aria-labelledby="quest-card-title">
        <header className="quest-card__header">
          <div className="quest-card__lights" aria-hidden>
            <span />
            <span />
            <span />
          </div>
          <h2 id="quest-card-title" className="quest-card__title">
            Start Your Quest
          </h2>
        </header>
        <p className="quest-card__description">
          Paste a public GitHub PR URL to begin your interactive walkthrough.
        </p>
        {state.status === "success" && state.result ? null : null}
        <form action={formAction} className="quest-card__form" onSubmit={() => setAnalyzing(true)}>
          <label className="sr-only" htmlFor="prUrl">
            GitHub pull request URL
          </label>
          <input
            id="prUrl"
            name="prUrl"
            type="url"
            placeholder="https://github.com/owner/repo/pull/123"
            className="quest-input"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            aria-invalid={state.status === "error" || !clientParse.ok}
            aria-describedby="pr-url-helper pr-url-diff"
            autoComplete="off"
          />
          <AnalyzeButton enabled={isClientValid} />
        </form>
        <p
          id="pr-url-helper"
          role={state.status === "error" ? "alert" : "status"}
          className={`quest-card__helper ${state.status === "error" ? "quest-card__helper--error" : ""}`}
        >
          {helperText}
        </p>
        <p id="pr-url-diff" className="quest-card__diff" aria-live="polite">
          {diffPreview ? (
            <>
              Derived diff endpoint: <code>{diffPreview}</code>
            </>
          ) : (
            <>Derived diff endpoint will appear once the URL is valid.</>
          )}
        </p>
        <p className="quest-card__example">
          Try an example:{" "}
          <a
            href="https://github.com/vercel/next.js/pull/12345"
            className="quest-card__example-link"
          >
            github.com/vercel/next.js/pull/12345
          </a>
        </p>
      </section>
      {/* Full-screen analyzing overlay */}
      {analyzing ? (
        <div className="analyzing-overlay" role="dialog" aria-modal="true" aria-labelledby="analyzing-title">
          <div className="retro-card analyzing-card">
            <div className="analyzing-card__spinner" aria-hidden />
            <h2 id="analyzing-title" className="pixel-heading analyzing-card__title">Analyzing PR…</h2>
            <p className="analyzing-card__desc">Fetching diff and planning your review steps.</p>
          </div>
        </div>
      ) : null}
      {/* Step viewer is now on /review page */}
    </>
  );
}
