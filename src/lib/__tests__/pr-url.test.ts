import { describe, expect, it } from "vitest";

import { parseGitHubPrUrl } from "../pr-url";

describe("parseGitHubPrUrl", () => {
  it("parses a fully qualified GitHub PR URL", () => {
    const result = parseGitHubPrUrl("https://github.com/vercel/next.js/pull/12345");

    expect(result).toEqual({
      ok: true,
      value: {
        owner: "vercel",
        repo: "next.js",
        prNumber: 12345,
        htmlUrl: "https://github.com/vercel/next.js/pull/12345",
        diffUrl: "https://github.com/vercel/next.js/pull/12345.diff",
      },
    });
  });

  it("fills in the protocol when omitted", () => {
    const result = parseGitHubPrUrl("github.com/fissionhq/pr-quest/pull/88");

    expect(result).toMatchObject({
      ok: true,
      value: {
        owner: "fissionhq",
        repo: "pr-quest",
        prNumber: 88,
      },
    });
  });

  it("accepts extra pull request sub-path segments", () => {
    const result = parseGitHubPrUrl("https://github.com/foo/bar/pull/42/files");

    expect(result).toMatchObject({
      ok: true,
      value: {
        htmlUrl: "https://github.com/foo/bar/pull/42",
        diffUrl: "https://github.com/foo/bar/pull/42.diff",
      },
    });
  });

  it("strips trailing .git from repository names", () => {
    const result = parseGitHubPrUrl("https://github.com/foo/bar.git/pull/23");

    expect(result).toMatchObject({
      ok: true,
      value: {
        repo: "bar",
      },
    });
  });

  it("fails for non GitHub hosts", () => {
    const result = parseGitHubPrUrl("https://gitlab.com/foo/bar/pull/123");

    expect(result).toEqual({
      ok: false,
      error: "Only public github.com pull requests are supported right now.",
    });
  });

  it("fails when path is not a pull request", () => {
    const result = parseGitHubPrUrl("https://github.com/foo/bar/issues/10");

    expect(result).toEqual({
      ok: false,
      error: "URL must point to a pull request, e.g. github.com/owner/repo/pull/123.",
    });
  });

  it("fails when pull request number is not numeric", () => {
    const result = parseGitHubPrUrl("https://github.com/foo/bar/pull/abc");

    expect(result).toEqual({
      ok: false,
      error: "Pull request number must be numeric.",
    });
  });

  it("fails when pull request number is zero", () => {
    const result = parseGitHubPrUrl("https://github.com/foo/bar/pull/0");

    expect(result).toEqual({
      ok: false,
      error: "Pull request number must be greater than zero.",
    });
  });
});

