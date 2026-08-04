import { z } from 'zod'
import { analysisGoalSchema, reviewedCandidateSchema } from '@/domain/analysis-config'

export const claimCategorySchema = z.enum([
  'skill',
  'responsibility',
  'achievement',
  'leadership',
  'metric',
])
export type ClaimCategory = z.infer<typeof claimCategorySchema>

export const CLAIM_CATEGORY_LABELS: Record<ClaimCategory, string> = {
  skill: '技能声明',
  responsibility: '责任声明',
  achievement: '成果声明',
  leadership: '管理声明',
  metric: '数据声明',
}

export const riskLevelSchema = z.enum(['high', 'medium', 'low'])
export type RiskLevel = z.infer<typeof riskLevelSchema>

export const llmResumeClaimSchema = z.object({
  content: z.string(),
  title: z.string(),
  category: claimCategorySchema,
  role: z.string(),
  sourceSection: z.string(),
  exaggerationRisk: riskLevelSchema,
  interviewRisk: riskLevelSchema,
  evidenceGap: z.array(z.string()),
  evidence: z.array(z.string()),
  initialQuestion: z.string(),
  initialIntent: z.string().optional().default(''),
  evaluationPoints: z.array(z.string()).min(1),
  verifyPoints: z.array(z.object({
    point: z.string(),
    importance: z.enum(['high', 'medium', 'low']),
  })).optional().default([]),
  trapPoints: z.array(z.string()).optional().default([]),
})

export const resumeClaimSchema = llmResumeClaimSchema.extend({
  id: z.string().min(1),
})
export type ResumeClaim = z.infer<typeof resumeClaimSchema>

export const jobMatchRequirementSchema = z.object({
  requirement: z.string(),
  match: z.enum(['strong', 'partial', 'gap']),
  evidence: z.array(z.string()),
  note: z.string(),
})

export const jobMatchSchema = z.object({
  requirements: z.array(jobMatchRequirementSchema),
  gaps: z.array(z.string()),
  interviewFocus: z.array(z.string()),
})
export type JobMatchRequirement = z.infer<typeof jobMatchRequirementSchema>
export type JobMatch = z.infer<typeof jobMatchSchema>

function hashClaim(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export function createClaimId(
  claim: Pick<ResumeClaim, 'content' | 'sourceSection'>,
  sourceIndex: number,
): string {
  return `claim-${sourceIndex + 1}-${hashClaim(`${claim.sourceSection}\n${claim.content}`)}`
}

export function attachClaimIds(
  claims: z.infer<typeof llmResumeClaimSchema>[],
): ResumeClaim[] {
  return claims.map((claim, index) => ({
    ...claim,
    id: createClaimId(claim, index),
  }))
}

export const resumeAnalysisSchema = z.object({
  candidate: z.string(),
  role: z.string(),
  sourceFile: z.string(),
  rawText: z.string(),
  summary: z.string(),
  analysisGoal: analysisGoalSchema.optional(),
  reviewedCandidates: z.array(reviewedCandidateSchema).optional(),
  jobDescription: z.string().optional(),
  jobMatch: jobMatchSchema.optional(),
  claims: z.array(resumeClaimSchema).min(1),
})
export type ResumeAnalysis = z.infer<typeof resumeAnalysisSchema>

export const llmAnalysisSchema = z.object({
  candidate: z.string(),
  role: z.string(),
  summary: z.string(),
  claims: z.array(llmResumeClaimSchema).min(1),
  jobMatch: jobMatchSchema.optional(),
})
export type LlmAnalysis = z.infer<typeof llmAnalysisSchema>
