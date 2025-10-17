import { NextResponse } from "next/server";

import { parseGitHubPrUrl } from "@/lib/pr-url";
import { debugLog, startDebugTimer } from "@/lib/debug";

const MAX_DIFF_BYTES = 1_048_576; // 1 MiB cap to avoid huge payloads in the MVP.
const GITHUB_DIFF_ACCEPT_HEADER = "application/vnd.github.v3.diff";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function isRateLimitResponse(response: Response) {
  if (response.status === 429) {
    return true;
  }

  if (response.status === 403) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      return true;
    }
  }

  return false;
}

function exceedsSizeLimit({
  headerLength,
  actualBytes,
}: {
  headerLength: string | null;
  actualBytes?: number;
}) {
  if (typeof actualBytes === "number" && Number.isFinite(actualBytes) && actualBytes > MAX_DIFF_BYTES) {
    return true;
  }

  if (!headerLength) {
    return false;
  }

  const parsed = Number(headerLength);
  return Number.isFinite(parsed) && parsed > MAX_DIFF_BYTES;
}

export async function GET(req: Request) {
  const t = startDebugTimer("api-diff", "GET /api/diff");
  const { searchParams } = new URL(req.url);
  const rawPrUrl = searchParams.get("prUrl");

  if (!rawPrUrl) {
    return errorResponse("Enter a GitHub pull request URL.", 400);
  }

  const parsed = parseGitHubPrUrl(rawPrUrl);
  if (!parsed.ok) {
    return errorResponse(parsed.error, 400);
  }

  const { diffUrl } = parsed.value;
  debugLog("api-diff", "fetching GitHub diff", { diffUrl });

  let githubResponse: Response;
  try {
    githubResponse = await fetch(diffUrl, {
      headers: {
        accept: GITHUB_DIFF_ACCEPT_HEADER,
        "user-agent": "PR-Quest-DiffFetcher/0.1 (+https://github.com/fissionhq/pr-quest)",
      },
      cache: "no-store",
      redirect: "follow",
    });
  } catch (error) {
    debugLog("api-diff", "fetch failed", { error: String(error) });
    return errorResponse("Unable to reach GitHub. Check your connection and try again.", 502);
  }

  if (isRateLimitResponse(githubResponse)) {
    return errorResponse("GitHub rate limit reached. Please wait a minute and try again.", 429);
  }

  if (githubResponse.status === 404) {
    return errorResponse("Pull request diff not found. Ensure the PR is public.", 404);
  }

  if (!githubResponse.ok) {
    return errorResponse("GitHub returned an unexpected error. Please try again later.", 502);
  }

  const contentLengthHeader = githubResponse.headers.get("content-length");

  if (exceedsSizeLimit({ headerLength: contentLengthHeader })) {
    return errorResponse("Diff is too large to analyze right now. Please try a smaller pull request.", 413);
  }

  const diffText = await githubResponse.text();
  const diffBytes = new TextEncoder().encode(diffText).length;
  debugLog("api-diff", "diff received", { bytes: diffBytes });

  if (exceedsSizeLimit({ headerLength: contentLengthHeader, actualBytes: diffBytes })) {
    return errorResponse("Diff is too large to analyze right now. Please try a smaller pull request.", 413);
  }

  return new NextResponse(diffText, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
  t.end({ bytes: diffBytes });
}
