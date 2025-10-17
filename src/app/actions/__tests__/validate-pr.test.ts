import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { validatePrAction, type PrValidationState } from "../validate-pr";

const initialState: PrValidationState = { status: "idle" };
const ORIGINAL_FETCH = global.fetch;
const SAMPLE_DIFF = readFileSync(resolve(process.cwd(), "tests/fixtures/heuristic-mix.diff"), "utf8");
const ORIGINAL_INTERNAL_ORIGIN = process.env.PR_QUEST_INTERNAL_ORIGIN;

beforeAll(() => {
  process.env.PR_QUEST_INTERNAL_ORIGIN = "http://localhost:3000";
});

afterAll(() => {
  if (ORIGINAL_INTERNAL_ORIGIN === undefined) {
    delete process.env.PR_QUEST_INTERNAL_ORIGIN;
  } else {
    process.env.PR_QUEST_INTERNAL_ORIGIN = ORIGINAL_INTERNAL_ORIGIN;
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  global.fetch = ORIGINAL_FETCH;
});

describe("validatePrAction", () => {
  it("returns a review plan when the diff and grouping succeed", async () => {
    global.fetch = vi
      .fn(async () => {
        return new Response(SAMPLE_DIFF, {
          status: 200,
          headers: {
            "content-length": String(Buffer.byteLength(SAMPLE_DIFF, "utf8")),
          },
        });
      }) as typeof global.fetch;

    const formData = new FormData();
    formData.set("prUrl", "https://github.com/example/repo/pull/42");

    const result = await validatePrAction(initialState, formData);

    expect(result.status).toBe("success");
    expect(result.result?.reviewPlan.steps.length).toBeGreaterThan(0);
    expect(result.result?.groupingMode).toBe("heuristic");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("returns a descriptive error when the diff fetch fails", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: "GitHub rate limit reached. Please wait a minute and try again.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }) as typeof global.fetch;

    const formData = new FormData();
    formData.set("prUrl", "https://github.com/example/repo/pull/42");

    const result = await validatePrAction(initialState, formData);

    expect(result.status).toBe("error");
    expect(result.message).toBe("GitHub rate limit reached. Please wait a minute and try again.");
  });
});
