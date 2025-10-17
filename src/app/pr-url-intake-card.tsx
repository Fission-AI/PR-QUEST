"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { parseGitHubPrUrl } from "@/lib/pr-url";
import { validatePrAction, type PrValidationState } from "./actions/validate-pr";

const initialState: PrValidationState = { status: "idle" };

function AnalyzeButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="pixel-button quest-button" aria-disabled={!enabled || pending} disabled={!enabled || pending}>
      {pending ? "Checking…" : "Begin your quest →"}
    </button>
  );
}

export function PrUrlIntakeCard() {
  const [inputValue, setInputValue] = useState("");
  const [state, formAction] = useActionState(validatePrAction, initialState);

  const clientParse = useMemo(() => {
    if (!inputValue.trim()) {
      return { ok: false as const, error: "Enter a GitHub pull request URL." };
    }

    return parseGitHubPrUrl(inputValue);
  }, [inputValue]);

  const isClientValid = clientParse.ok;

  const diffPreview =
    state.status === "success"
      ? state.result?.diffUrl
      : clientParse.ok
        ? clientParse.value.diffUrl
        : null;

  const helperText =
    state.status === "error"
      ? state.message
      : clientParse.ok
        ? "Looks good — ready to analyze this pull request."
        : "Paste a public GitHub PR URL to begin.";

  return (
    <section className="quest-card" aria-labelledby="quest-card-title">
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
      <form action={formAction} className="quest-card__form">
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
  );
}
