import { z } from "zod";

export const PRIORITY_VALUES = ["high", "medium", "low"] as const;

export const DiffReferenceSchema = z.object({
  file_id: z.string().min(1),
  hunk_ids: z.array(z.string().min(1)).min(1),
});

export const ReviewStepSchema = z.object({
  step_id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  objective: z.string().min(1),
  priority: z.enum(PRIORITY_VALUES),
  diff_refs: z.array(DiffReferenceSchema).min(1),
  notes_suggested: z.array(z.string().min(1)).default([]),
  badges: z.array(z.string().min(1)).default([]),
});

export const ReviewPlanSchema = z.object({
  version: z.literal(1),
  pr_overview: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
  }),
  steps: z.array(ReviewStepSchema).max(6),
  end_state: z.object({
    acceptance_checks: z.array(z.string().min(1)),
    risk_calls: z.array(z.string().min(1)),
  }),
});

export type Priority = (typeof PRIORITY_VALUES)[number];
export type ReviewPlan = z.infer<typeof ReviewPlanSchema>;
export type ReviewStep = z.infer<typeof ReviewStepSchema>;
