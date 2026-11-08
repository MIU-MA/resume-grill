import { z } from 'zod'
import type { KnowledgeItem } from './knowledge'

export const interviewContextSchema = z.object({
  interviewerStyle: z.enum(['standard', 'probing', 'supportive']).optional(),
  interviewKind: z.enum(['technical', 'architecture', 'project', 'hr']).optional(),
  jobDescription: z.string().default(''),
  reviewProgress: z.array(z.object({
    topic: z.string(), status: z.enum(['open', 'mastered']), note: z.string(),
  })).default([]),
})
export type InterviewContext = z.infer<typeof interviewContextSchema>

export function buildInterviewContext(jobDescription: string | undefined, items: KnowledgeItem[], claimId: string, interviewKind?: import('./interview-strategy').InterviewKind): InterviewContext {
  return {
    ...(interviewKind ? { interviewKind } : {}),
    jobDescription: jobDescription?.trim() ?? '',
    reviewProgress: items.filter(item => item.claimId === claimId).map(item => ({ topic: item.title, status: item.status, note: item.note })),
  }
}
