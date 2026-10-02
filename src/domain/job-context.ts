import { z } from 'zod'

// Kept with local resume snapshots, never sent as part of the SMTP payload.
export const jobContextSchema = z.object({
  applicationId: z.string(),
  company: z.string(),
  role: z.string(),
  sourceUrl: z.string(),
  resumeVersion: z.string(),
  resumeDocumentId: z.string().optional(),
  resumeUpdatedAt: z.number(),
})

export type JobContext = z.infer<typeof jobContextSchema>
