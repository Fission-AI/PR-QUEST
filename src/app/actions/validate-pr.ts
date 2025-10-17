"use server";

import { parseGitHubPrUrl, type ParsedGitHubPrUrl } from "@/lib/pr-url";

export interface PrValidationState {
  status: "idle" | "success" | "error";
  message?: string;
  result?: ParsedGitHubPrUrl;
}

export async function validatePrAction(
  _prevState: PrValidationState,
  formData: FormData,
): Promise<PrValidationState> {
  const rawUrl = formData.get("prUrl");

  if (typeof rawUrl !== "string") {
    return { status: "error", message: "Enter a GitHub pull request URL." };
  }

  const parsed = parseGitHubPrUrl(rawUrl);

  if (!parsed.ok) {
    return { status: "error", message: parsed.error };
  }

  return {
    status: "success",
    result: parsed.value,
  };
}
