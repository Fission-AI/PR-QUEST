import { z } from "zod";

const DIFF_FILE_STATUSES = ["added", "deleted", "modified", "renamed", "copied"] as const;

export const DiffHunkSchema = z.object({
  hunk_id: z.string().min(1),
  old_start: z.number().int().min(0),
  new_start: z.number().int().min(0),
  header: z.string().min(1),
});

export const DiffFileEntrySchema = z.object({
  file_id: z.string().min(1),
  status: z.enum(DIFF_FILE_STATUSES),
  language: z.string().min(1).nullable(),
  hunks: z.array(DiffHunkSchema).min(1),
});

export const DiffIndexSchema = z.object({
  diff_index_version: z.literal(1),
  files: z.array(DiffFileEntrySchema),
});

const RawGroupingMetadataSchema = z
  .object({
    prTitle: z.string().optional(),
    prDescription: z.string().optional(),
  })
  .partial();

function normalizeMetadata(metadata: z.infer<typeof RawGroupingMetadataSchema>) {
  const normalized: GroupingMetadata = {};

  if (metadata.prTitle) {
    const trimmed = metadata.prTitle.trim();
    if (trimmed) {
      normalized.prTitle = trimmed;
    }
  }

  if (metadata.prDescription) {
    const trimmed = metadata.prDescription.trim();
    if (trimmed) {
      normalized.prDescription = trimmed;
    }
  }

  return normalized;
}

export const GroupingMetadataSchema = RawGroupingMetadataSchema.transform(normalizeMetadata);

export const GroupingRequestSchema = z.object({
  diffIndex: DiffIndexSchema,
  metadata: RawGroupingMetadataSchema.optional().transform((metadata) => normalizeMetadata(metadata ?? {})),
});

export type GroupingMetadata = z.infer<typeof GroupingMetadataSchema>;
export type GroupingRequest = z.infer<typeof GroupingRequestSchema>;
