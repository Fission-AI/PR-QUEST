import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";

import { GET } from "../route";
import { server } from "@/test/mocks/server";

const SAMPLE_DIFF_PATH = path.resolve(process.cwd(), "tests/fixtures/sample.diff");
const SAMPLE_DIFF = readFileSync(SAMPLE_DIFF_PATH, "utf8");
const SAMPLE_DIFF_BYTES = new TextEncoder().encode(SAMPLE_DIFF).length;

function buildRequest(prUrl: string | null) {
  const base = "http://localhost/api/diff";
  return new Request(prUrl ? `${base}?prUrl=${encodeURIComponent(prUrl)}` : base);
}

describe("GET /api/diff", () => {
  it("requires a prUrl query parameter", async () => {
    const response = await GET(buildRequest(null));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Enter a GitHub pull request URL.",
    });
  });

  it("validates the provided GitHub pull request URL", async () => {
    const response = await GET(buildRequest("https://example.com/foo/bar"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Only public github.com pull requests are supported right now.",
    });
  });

  it("proxies the diff when GitHub responds with success", async () => {
    const prUrl = "https://github.com/fissionhq/pr-quest/pull/88";

    server.use(
      http.get(`${prUrl}.diff`, () =>
        HttpResponse.text(SAMPLE_DIFF, {
          headers: {
            "content-type": "text/plain",
            "content-length": String(SAMPLE_DIFF_BYTES),
          },
        }),
      ),
    );

    const response = await GET(buildRequest(prUrl));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(SAMPLE_DIFF);
  });

  it("returns a friendly error when GitHub rate limits the request", async () => {
    const prUrl = "https://github.com/fissionhq/pr-quest/pull/99";

    server.use(
      http.get(`${prUrl}.diff`, () =>
        HttpResponse.text("rate limited", {
          status: 403,
          headers: {
            "x-ratelimit-remaining": "0",
          },
        }),
      ),
    );

    const response = await GET(buildRequest(prUrl));

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "GitHub rate limit reached. Please wait a minute and try again.",
    });
  });

  it("returns 413 when the diff exceeds the size limit advertised in headers", async () => {
    const prUrl = "https://github.com/fissionhq/pr-quest/pull/100";

    server.use(
      http.get(`${prUrl}.diff`, () =>
        HttpResponse.text("too large", {
          headers: {
            "content-length": String(2_000_000),
          },
        }),
      ),
    );

    const response = await GET(buildRequest(prUrl));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "Diff is too large to analyze right now. Please try a smaller pull request.",
    });
  });

  it("returns 404 when GitHub cannot find the diff", async () => {
    const prUrl = "https://github.com/fissionhq/pr-quest/pull/404";

    server.use(
      http.get(`${prUrl}.diff`, () =>
        HttpResponse.json(
          { message: "Not Found" },
          {
            status: 404,
          },
        ),
      ),
    );

    const response = await GET(buildRequest(prUrl));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Pull request diff not found. Ensure the PR is public.",
    });
  });

  it("falls back to a generic error when GitHub returns a server error", async () => {
    const prUrl = "https://github.com/fissionhq/pr-quest/pull/500";

    server.use(
      http.get(`${prUrl}.diff`, () => HttpResponse.text("oops", { status: 500 })),
    );

    const response = await GET(buildRequest(prUrl));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "GitHub returned an unexpected error. Please try again later.",
    });
  });

  it("enforces the size limit even when GitHub omits content-length", async () => {
    const prUrl = "https://github.com/fissionhq/pr-quest/pull/777";
    const oversizedDiff = "a".repeat(1_048_576 + 1);

    server.use(
      http.get(`${prUrl}.diff`, () => HttpResponse.text(oversizedDiff)),
    );

    const response = await GET(buildRequest(prUrl));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "Diff is too large to analyze right now. Please try a smaller pull request.",
    });
  });
});
