import Link from "next/link";
import { StepViewerClientWrapper } from "./StepViewerClientWrapper";
import { GET as diffRoute } from "../api/diff/route";
import { POST as groupRoute } from "../api/group/route";
import { parseUnifiedDiff } from "@/lib/diff-index";
import { GroupingRequestSchema } from "@/lib/grouping-schemas";
import { ReviewPlanSchema } from "@/lib/review-plan-schema";

function getOrigin() {
  return process.env.PR_QUEST_INTERNAL_ORIGIN ?? "http://localhost:3000";
}

async function getPlanAndDiff(prUrl: string) {
  const origin = getOrigin();
  const diffResponse = await diffRoute(new Request(`${origin}/api/diff?prUrl=${encodeURIComponent(prUrl)}`));
  if (!diffResponse.ok) {
    const err = await safeJson(diffResponse);
    return { error: err?.error ?? "Unable to download the pull request diff." } as const;
  }

  const diffText = await diffResponse.text();
  const diffIndex = parseUnifiedDiff(diffText);

  const groupingInput = GroupingRequestSchema.parse({
    diffIndex,
    metadata: {},
  });

  const groupResponse = await groupRoute(
    new Request(`${origin}/api/group`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(groupingInput),
    }),
  );

  if (!groupResponse.ok) {
    const err = await safeJson(groupResponse);
    return { error: err?.error ?? "Grouping failed." } as const;
  }

  const planJson = await groupResponse.json();
  const reviewPlan = ReviewPlanSchema.parse(planJson);
  return { reviewPlan, diffText } as const;
}

async function safeJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export default async function ReviewPage({ searchParams }: { searchParams: { prUrl?: string; step?: string } }) {
  const prUrl = searchParams.prUrl;

  if (!prUrl) {
    return (
      <div className="home-shell">
        <div className="retro-card" role="alert">
          <p>Missing PR URL. Start from the home page.</p>
          <p>
            <Link className="pixel-button" href="/">Go to Home</Link>
          </p>
        </div>
      </div>
    );
  }

  const result = await getPlanAndDiff(prUrl);
  if ("error" in result) {
    return (
      <div className="home-shell">
        <div className="retro-card" role="alert">
          <p>We couldn't load the review plan: {result.error}</p>
          <p>
            <Link className="pixel-button" href="/">Try a different PR</Link>
          </p>
        </div>
      </div>
    );
  }

  const initial = Number(searchParams.step ?? "0") || 0;

  return (
    <div className="home-shell" style={{ maxWidth: 1200 }}>
      {/* Client wrapper to sync step param */}
      {/* We keep this component server-rendered but StepViewer is a client component */}
      <StepViewerClientWrapper prUrl={prUrl} initialStepIndex={initial} planAndDiff={result} />
    </div>
  );
}
