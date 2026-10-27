import { z } from 'zod'
import type { KnowledgeItem } from './knowledge'

export const interviewContextSchema = z.object({
  jobDescription: z.string().default(''),
  reviewProgress: z.array(z.object({
    topic: z.string(), status: z.enum(['open', 'mastered']), note: z.string(),
  })).default([]),
})
export type InterviewContext = z.infer<typeof interviewContextSchema>

export function buildInterviewContext(jobDescription: string | undefined, items: KnowledgeItem[], claimId: string): InterviewContext {
  return {
    jobDescription: jobDescription?.trim() ?? '',
    reviewProgress: items.filter(item => item.claimId === claimId).map(item => ({ topic: item.title, status: item.status, note: item.note })),
  }
}
