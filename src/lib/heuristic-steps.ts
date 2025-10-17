import type { DiffFileEntry, DiffIndex, DiffFileStatus } from "./diff-index";
import { ReviewPlanSchema, type Priority } from "./review-plan-schema";
import type { ReviewPlan, ReviewStep } from "./review-plan-schema";

export { ReviewPlanSchema } from "./review-plan-schema";
export type { ReviewPlan, ReviewStep } from "./review-plan-schema";

type GroupCategory = "docs" | "tests" | "config" | "feature" | "misc";

interface GroupContext {
  key: string;
  category: GroupCategory;
  topSegment?: string;
  files: DiffFileEntry[];
}

interface BuildHeuristicReviewPlanOptions {
  diffIndex: DiffIndex;
  prTitle?: string;
  prDescription?: string;
}

const DOC_EXTENSIONS = new Set(["md", "mdx", "rst", "adoc", "txt"]);
const TEST_KEYWORDS = ["__tests__", "spec", "test", "fixture"];
const CONFIG_EXTENSIONS = new Set(["json", "yml", "yaml", "toml", "ini", "conf", "config"]);
const CONFIG_FILENAMES = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "eslint.config.mjs",
  ".eslintrc",
  ".eslintrc.json",
  ".eslintrc.js",
  "vite.config.ts",
  "vitest.config.mts",
  "next.config.ts",
]);

const STATUS_VERBS: Record<DiffFileStatus, string> = {
  added: "added",
  deleted: "removed",
  modified: "updated",
  renamed: "renamed",
  copied: "copied",
};

const CATEGORY_SORT_ORDER: Record<GroupCategory, number> = {
  docs: 0,
  tests: 1,
  config: 2,
  feature: 3,
  misc: 4,
};

function normalizePathLower(path: string) {
  return path.toLowerCase();
}

function isDocumentationFile(file: DiffFileEntry) {
  const lower = normalizePathLower(file.file_id);
  if (DOC_EXTENSIONS.has((file.language ?? "").toLowerCase())) {
    return true;
  }

  if (lower.includes("/docs/") || lower.startsWith("docs/") || lower.includes("readme") || lower.includes("changelog")) {
    return true;
  }

  return false;
}

function isTestFile(file: DiffFileEntry) {
  const lower = normalizePathLower(file.file_id);
  return TEST_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function isConfigFile(file: DiffFileEntry) {
  const lower = normalizePathLower(file.file_id);
  const filename = file.file_id.split("/").pop() ?? file.file_id;

  if (CONFIG_EXTENSIONS.has((file.language ?? "").toLowerCase())) {
    return true;
  }

  if (CONFIG_FILENAMES.has(filename)) {
    return true;
  }

  if (lower.includes("/config/") || lower.startsWith("config/") || lower.includes(".github/")) {
    return true;
  }

  return false;
}

function analyzeFile(file: DiffFileEntry): GroupContext {
  if (isDocumentationFile(file)) {
    return { key: "docs", category: "docs", files: [file] };
  }

  if (isTestFile(file)) {
    return { key: "tests", category: "tests", files: [file] };
  }

  if (isConfigFile(file)) {
    return { key: "config", category: "config", files: [file] };
  }

  const segments = file.file_id.split("/");
  const topSegment = segments.length > 1 ? segments[0] : "(root)";

  return {
    key: `feature:${topSegment}`,
    category: "feature",
    topSegment,
    files: [file],
  };
}

function mergeGroupContexts(contexts: GroupContext[]) {
  const merged = new Map<string, GroupContext>();

  for (const context of contexts) {
    const existing = merged.get(context.key);
    if (!existing) {
      merged.set(context.key, { ...context });
      continue;
    }

    merged.set(context.key, {
      ...existing,
      files: existing.files.concat(context.files),
    });
  }

  return Array.from(merged.values());
}

function summarizeFiles(files: DiffFileEntry[]) {
  const fileIds = files.map((file) => file.file_id);
  if (fileIds.length === 1) {
    return fileIds[0];
  }

  if (fileIds.length === 2) {
    return `${fileIds[0]} and ${fileIds[1]}`;
  }

  const remaining = fileIds.length - 2;
  return `${fileIds[0]}, ${fileIds[1]} +${remaining} more`;
}

function summarizeStatuses(files: DiffFileEntry[]) {
  const unique = Array.from(new Set(files.map((file) => STATUS_VERBS[file.status])));
  if (unique.length === 0) {
    return "updated";
  }

  if (unique.length === 1) {
    return unique[0];
  }

  return unique.slice(0, -1).join(", ") + ` and ${unique.at(-1)}`;
}

function humanizeSegment(segment: string | undefined) {
  if (!segment || segment === "(root)") {
    return "root files";
  }

  if (segment === "src") {
    return "source code";
  }

  const replaced = segment.replaceAll(/[-_]/g, " ");
  return replaced.slice(0, 1).toUpperCase() + replaced.slice(1);
}

function describeFeatureGroup(group: GroupContext) {
  const fileSummary = summarizeFiles(group.files);
  const statusSummary = summarizeStatuses(group.files);
  const label = humanizeSegment(group.topSegment);

  const title = `Review ${label} changes`;
  const description = `Focus on ${statusSummary} files: ${fileSummary}.`;
  const objective = `Exercise the affected ${label} paths to ensure behavior stays correct.`;

  return {
    title,
    description,
    objective,
    priority: "high" as Priority,
    notes: ["Probe the main flows these files touch for regressions."],
    badges: ["Code"],
  };
}

function describeDocsGroup(group: GroupContext) {
  const fileSummary = summarizeFiles(group.files);
  const description = `Confirm documentation reflects the latest behavior in ${fileSummary}.`;
  const objective = "Check for accuracy, clarity, and formatting issues in the updated docs.";

  return {
    title: "Review documentation updates",
    description,
    objective,
    priority: "low" as Priority,
    notes: ["Look for outdated references or typos."],
    badges: ["Docs"],
  };
}

function describeTestsGroup(group: GroupContext) {
  const fileSummary = summarizeFiles(group.files);
  const description = `Review the updated test coverage across ${fileSummary}.`;
  const objective = "Ensure tests cover the intended scenarios and still pass.";

  return {
    title: "Review test coverage adjustments",
    description,
    objective,
    priority: "medium" as Priority,
    notes: ["Verify that assertions align with the new behavior."],
    badges: ["Tests"],
  };
}

function describeConfigGroup(group: GroupContext) {
  const fileSummary = summarizeFiles(group.files);
  const description = `Inspect configuration tweaks within ${fileSummary}.`;
  const objective = "Ensure configuration loads correctly locally and in CI.";

  return {
    title: "Review configuration updates",
    description,
    objective,
    priority: "medium" as Priority,
    notes: ["Validate that defaults and environment-specific values remain correct."],
    badges: ["Config"],
  };
}

function describeMiscGroup(group: GroupContext) {
  const fileSummary = summarizeFiles(group.files);
  const description = `Sweep through the remaining updates: ${fileSummary}.`;
  const objective = "Spot-check these smaller changes for unintended side effects.";

  return {
    title: "Review consolidated updates",
    description,
    objective,
    priority: "medium" as Priority,
    notes: ["Scan for inconsistencies that the heuristics bundled together."],
    badges: ["Mixed"],
  };
}

function describeGroup(group: GroupContext) {
  switch (group.category) {
    case "docs":
      return describeDocsGroup(group);
    case "tests":
      return describeTestsGroup(group);
    case "config":
      return describeConfigGroup(group);
    case "misc":
      return describeMiscGroup(group);
    case "feature":
    default:
      return describeFeatureGroup(group);
  }
}

function toDiffRefs(files: DiffFileEntry[]) {
  return files.map((file) => ({
    file_id: file.file_id,
    hunk_ids: file.hunks.map((hunk) => hunk.hunk_id),
  }));
}

function aggregateAcceptanceChecks(groups: GroupContext[]) {
  const checks = new Set<string>();

  if (groups.some((group) => group.category === "tests")) {
    checks.add("Run pnpm test to confirm coverage remains green.");
  }

  if (groups.some((group) => group.category === "docs")) {
    checks.add("Proofread updated documentation for accuracy and formatting.");
  }

  if (groups.some((group) => group.category === "config")) {
    checks.add("Validate configuration changes by running pnpm build.");
  }

  if (groups.some((group) => group.category === "feature")) {
    checks.add("Smoke test the impacted flows in the application.");
  }

  if (checks.size === 0) {
    checks.add("Confirm the diff renders as expected.");
  }

  return Array.from(checks);
}

function aggregateRiskCalls(groups: GroupContext[]) {
  const risks = new Set<string>();

  if (groups.some((group) => group.category === "feature")) {
    risks.add("Logic changes could introduce regressions in the touched modules.");
  }

  if (groups.some((group) => group.category === "config")) {
    risks.add("Configuration adjustments could impact build or deployment pipelines.");
  }

  if (groups.some((group) => group.category === "tests")) {
    risks.add("Test changes might conceal gaps in coverage if not verified carefully.");
  }

  if (groups.some((group) => group.category === "docs")) {
    risks.add("Documentation updates may drift from actual behavior if review misses nuances.");
  }

  if (risks.size === 0) {
    risks.add("Heuristic grouping may have missed contextual dependencies.");
  }

  return Array.from(risks);
}

function limitGroupCount(groups: GroupContext[]) {
  if (groups.length <= 6) {
    return groups;
  }

  const sorted = [...groups].sort((a, b) => {
    const weightA = a.files.reduce((acc, file) => acc + file.hunks.length, 0);
    const weightB = b.files.reduce((acc, file) => acc + file.hunks.length, 0);

    return weightB - weightA;
  });

  const primary = sorted.slice(0, 5);
  const remaining = sorted.slice(5);

  const merged: GroupContext = {
    key: "misc",
    category: "misc",
    files: remaining.flatMap((group) => group.files),
  };

  return [...primary, merged];
}

function sortGroups(groups: GroupContext[]) {
  return [...groups].sort((a, b) => {
    const categoryOrder = CATEGORY_SORT_ORDER[a.category] - CATEGORY_SORT_ORDER[b.category];
    if (categoryOrder !== 0) {
      return categoryOrder;
    }

    const byFileCount = b.files.length - a.files.length;
    if (byFileCount !== 0) {
      return byFileCount;
    }

    return a.key.localeCompare(b.key);
  });
}

function buildSteps(groups: GroupContext[]) {
  return groups.map((group, index) => {
    const descriptor = describeGroup(group);
    const diffRefs = toDiffRefs(group.files);

    return {
      step_id: `step-${index + 1}`,
      title: descriptor.title,
      description: descriptor.description,
      objective: descriptor.objective,
      priority: descriptor.priority,
      diff_refs: diffRefs,
      notes_suggested: descriptor.notes,
      badges: descriptor.badges,
    };
  });
}

function buildOverview(groups: GroupContext[], { diffIndex, prTitle }: BuildHeuristicReviewPlanOptions) {
  const fileCount = diffIndex.files.length;
  const areaLabels = new Set<string>();

  for (const group of groups) {
    switch (group.category) {
      case "docs":
        areaLabels.add("documentation");
        break;
      case "tests":
        areaLabels.add("tests");
        break;
      case "config":
        areaLabels.add("configuration");
        break;
      case "feature":
        areaLabels.add("code");
        break;
      case "misc":
        areaLabels.add("mixed updates");
        break;
      default:
        break;
    }
  }

  const overviewTitle =
    prTitle && prTitle.trim().length > 0
      ? `Heuristic walkthrough for: ${prTitle.trim()}`
      : `Heuristic walkthrough across ${fileCount} file${fileCount === 1 ? "" : "s"}`;

  const focusAreas =
    areaLabels.size > 0 ? Array.from(areaLabels).join(", ") : "general diff inspection";

  const summary = `This heuristic baseline groups the diff into ${groups.length} review step${
    groups.length === 1 ? "" : "s"
  } covering ${focusAreas}.`;

  return {
    title: overviewTitle,
    summary,
  };
}

export function buildHeuristicReviewPlan(options: BuildHeuristicReviewPlanOptions): ReviewPlan {
  const { diffIndex } = options;
  const filesWithHunks = diffIndex.files.filter((file) => file.hunks.length > 0);

  if (filesWithHunks.length === 0) {
    const emptyPlan = {
      version: 1 as const,
      pr_overview: {
        title: "No diff content detected",
        summary: "The supplied diff did not contain any reviewable hunks.",
      },
      steps: [] as ReviewStep[],
      end_state: {
        acceptance_checks: ["Confirm the pull request exposes code or documentation changes."],
        risk_calls: ["Empty diffs may indicate fetch or permissions issues."],
      },
    };

    return ReviewPlanSchema.parse(emptyPlan);
  }

  const contexts = filesWithHunks.map((file) => analyzeFile(file));
  const mergedGroups = mergeGroupContexts(contexts);
  const cappedGroups = limitGroupCount(mergedGroups);
  const sortedGroups = sortGroups(cappedGroups);

  const steps = buildSteps(sortedGroups);

  const plan = {
    version: 1 as const,
    pr_overview: buildOverview(sortedGroups, options),
    steps,
    end_state: {
      acceptance_checks: aggregateAcceptanceChecks(sortedGroups),
      risk_calls: aggregateRiskCalls(sortedGroups),
    },
  };

  return ReviewPlanSchema.parse(plan);
}
