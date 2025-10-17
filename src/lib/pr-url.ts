import { z } from "zod";

export interface ParsedGitHubPrUrl {
  owner: string;
  repo: string;
  prNumber: number;
  htmlUrl: string;
  diffUrl: string;
}

export type ParseResult<TSuccess> =
  | { ok: true; value: TSuccess }
  | { ok: false; error: string };

const TrimmedStringSchema = z
  .string({
    required_error: "Enter a GitHub pull request URL.",
    invalid_type_error: "Enter a GitHub pull request URL.",
  })
  .transform((value) => value.trim())
  .pipe(
    z.string().min(1, "Enter a GitHub pull request URL."),
  );

const PullRequestPathSchema = z.object({
  owner: z
    .string()
    .min(1, "Repository owner is missing.")
    .max(39, "Repository owner looks too long.")
    .regex(/^[A-Za-z0-9-]+$/, "Repository owner can only include letters, numbers, and hyphens."),
  repo: z
    .string()
    .min(1, "Repository name is missing.")
    .max(100, "Repository name looks too long.")
    .regex(/^[A-Za-z0-9_.-]+$/, "Repository name can only include letters, numbers, dots, underscores, and hyphens."),
  pullSegment: z.literal("pull", {
    errorMap: () => ({
      message: "URL must point to a pull request, e.g. github.com/owner/repo/pull/123.",
    }),
  }),
  prNumber: z
    .string({
      required_error: "Pull request number is missing.",
      invalid_type_error: "Pull request number must be numeric.",
    })
    .regex(/^\d+$/, "Pull request number must be numeric.")
    .refine((value) => Number(value) > 0, {
      message: "Pull request number must be greater than zero.",
    }),
});

export function parseGitHubPrUrl(rawInput: string): ParseResult<ParsedGitHubPrUrl> {
  const trimmedResult = TrimmedStringSchema.safeParse(rawInput);
  if (!trimmedResult.success) {
    return { ok: false, error: trimmedResult.error.issues[0]?.message ?? "Enter a GitHub pull request URL." };
  }

  if (!trimmedResult.data) {
    return { ok: false, error: "Enter a GitHub pull request URL." };
  }

  const input = trimmedResult.data;
  const hydratedInput = input.match(/^[a-z]+:\/\//i) ? input : `https://${input}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(hydratedInput);
  } catch {
    return { ok: false, error: "Enter a valid URL, e.g. https://github.com/org/repo/pull/123." };
  }

  const protocol = parsedUrl.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    return { ok: false, error: "Only http(s) URLs are supported." };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (hostname === "www.github.com") {
    parsedUrl.hostname = "github.com";
  } else if (hostname !== "github.com") {
    return { ok: false, error: "Only public github.com pull requests are supported right now." };
  }

  const pathSegments = parsedUrl.pathname.split("/").filter(Boolean);
  if (pathSegments.length < 4) {
    return {
      ok: false,
      error: "URL must look like github.com/owner/repo/pull/123.",
    };
  }

  const pathResult = PullRequestPathSchema.safeParse({
    owner: pathSegments[0],
    repo: pathSegments[1]?.replace(/\.git$/, ""),
    pullSegment: pathSegments[2],
    prNumber: pathSegments[3],
  });

  if (!pathResult.success) {
    return { ok: false, error: pathResult.error.issues[0]?.message ?? "Enter a valid GitHub pull request URL." };
  }

  const { owner, repo, prNumber } = pathResult.data;
  const prNumberInt = Number(prNumber);

  if (!Number.isSafeInteger(prNumberInt)) {
    return { ok: false, error: "Pull request number is out of range." };
  }

  const canonical = `https://github.com/${owner}/${repo}/pull/${prNumberInt}`;

  return {
    ok: true,
    value: {
      owner,
      repo,
      prNumber: prNumberInt,
      htmlUrl: canonical,
      diffUrl: `${canonical}.diff`,
    },
  };
}
