import { z } from 'zod'
import { sourceUrlSchema, type CareerDiscovery, type CareerPage } from './mail-schema'

export const assistantPlanSchema = z.object({
  keywords: z.array(z.string().trim().min(1).max(50)).min(1).max(12),
  cities: z.array(z.string().trim().min(1).max(40)).max(10),
  experience: z.string().max(200),
  excludedCompanies: z.array(z.string().trim().min(1).max(120)).max(30),
  sourceUrls: z.array(sourceUrlSchema).min(1).max(8),
})
export type AssistantPlan = z.infer<typeof assistantPlanSchema>
export const matchingJobSchema = z.object({
  id: z.string().min(1).max(2400), company: z.string().max(120), role: z.string().min(1).max(120),
  url: sourceUrlSchema, description: z.string().max(12000),
})
export type MatchingJob = z.infer<typeof matchingJobSchema>
export const assessmentSchema = z.object({
  id: z.string(), verdict: z.enum(['match', 'review', 'skip']), summary: z.string().min(1).max(500),
  checks: z.array(z.object({
    requirement: z.string().min(1).max(200), status: z.enum(['supported', 'fits_goal', 'missing', 'conflict', 'unknown']),
    jobQuote: z.string().max(500), resumeQuote: z.string().max(500),
  })).min(1).max(8),
})
export type JobAssessment = z.infer<typeof assessmentSchema>
export type AssistantJob = {
  id: string; page: CareerPage; assessment?: JobAssessment; error?: string
}
export type AssistantTask = {
  version: 1; id: string; goal: string; createdAt: number; updatedAt: number
  resume: { id: string; name: string; text: string; updatedAt: number; attachment?: File; attachmentUpdatedAt?: number }
  plan?: AssistantPlan; status: 'paused' | 'running' | 'complete'; message: string
  sources: Array<{ company: string; url: string; status: 'pending' | 'done' | 'failed'; error?: string }>
  jobs: AssistantJob[]
}
export type JobAssistantTools = {
  connected: boolean; disabled: boolean; slots: number
  existingJobs: Array<{ sourceUrl: string; role: string }>
  preferredResumeId?: string
  onConnect: () => void; onBusy: (busy: boolean) => void
  discover: (url: string) => Promise<CareerDiscovery>; read: (url: string) => Promise<CareerPage>
  onImport: (pages: CareerPage[], resume: AssistantTask['resume']) => Promise<void>
}

export function groundedAssessments(resume: string, jobs: MatchingJob[]) {
  return z.object({ results: z.array(assessmentSchema).length(jobs.length) }).superRefine((data, context) => {
    const seen = new Set<string>()
    for (const result of data.results) {
      const job = jobs.find(item => item.id === result.id)
      if (!job || seen.has(result.id)) {
        context.addIssue({ code: 'custom', message: '岗位缺失或重复' }); continue
      }
      seen.add(result.id)
      const jobText = [job.company, job.role, job.description].join('\n')
      for (const check of result.checks) {
        if ((check.jobQuote && !jobText.includes(check.jobQuote)) || (check.resumeQuote && !resume.includes(check.resumeQuote))
          || (check.status === 'supported' && (!check.jobQuote.trim() || !check.resumeQuote.trim()))
          || (['fits_goal', 'missing', 'conflict'].includes(check.status) && !check.jobQuote.trim())) {
          context.addIssue({ code: 'custom', message: '判断缺少原文依据' })
        }
      }
      if (result.verdict === 'match' && (!job.description.trim() || !result.checks.some(check => check.status === 'supported') || result.checks.some(check => ['conflict', 'unknown'].includes(check.status)))) {
        result.verdict = 'review'
      }
    }
  })
}
