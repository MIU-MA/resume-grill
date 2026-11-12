import { z } from 'zod'

export const resumeSnapshotInput = z.object({
  sourceName: z.string().min(1).max(512).refine(value => !!value.trim()),
  rawText: z.string().min(1).refine(value => !!value.trim() && new TextEncoder().encode(value).length <= 1024 * 1024),
}).strict()

export const resumeSnapshotSummary = resumeSnapshotInput.omit({ rawText: true }).extend({
  id: z.string().regex(/^[a-f0-9]{32}$/),
  createdAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
})
export const resumeSnapshot = resumeSnapshotSummary.extend({ rawText: resumeSnapshotInput.shape.rawText })
export type ResumeSnapshot = z.infer<typeof resumeSnapshot>
export type ResumeSnapshotSummary = z.infer<typeof resumeSnapshotSummary>
