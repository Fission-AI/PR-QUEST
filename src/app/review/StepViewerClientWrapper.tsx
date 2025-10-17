"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { StepViewer } from "../step-viewer";
import type { ReviewPlan } from "@/lib/review-plan-schema";

type StepViewerClientWrapperProps = {
  prUrl: string;
  initialStepIndex: number;
  planAndDiff: { reviewPlan: ReviewPlan; diffText: string };
};

export function StepViewerClientWrapper({ prUrl, initialStepIndex, planAndDiff }: StepViewerClientWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleStepChange = (index: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("prUrl", prUrl);
    params.set("step", String(index));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <StepViewer
      plan={planAndDiff.reviewPlan}
      diffText={planAndDiff.diffText}
      initialStepIndex={initialStepIndex}
      onStepChange={handleStepChange}
    />
  );
}


