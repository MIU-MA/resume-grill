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

export const masteryDimensionSchema = z.enum([
  'context',
  'practice',
  'principle',
  'decision',
  'troubleshooting',
  'boundary',
])
export type MasteryDimension = z.infer<typeof masteryDimensionSchema>

export const MASTERY_DIMENSION_LABELS: Record<MasteryDimension, string> = {
  context: '背景与动机',
  practice: '实践与实现',
  principle: '原理与机制',
  decision: '决策与取舍',
  troubleshooting: '问题与排查',
  boundary: '限制与边界',
}

export const masteryPointSchema = z.object({
  point: z.string().max(60),
  dimension: masteryDimensionSchema,
  importance: z.enum(['high', 'medium', 'low']),
})
export type MasteryPoint = z.infer<typeof masteryPointSchema>

export const testPrioritySchema = z.enum(['high', 'medium', 'low'])
export type TestPriority = z.infer<typeof testPrioritySchema>

export const TEST_PRIORITY_LABELS: Record<TestPriority, string> = {
  high: '优先测试',
  medium: '建议测试',
  low: '可选测试',
}

export const compactClaimSchema = z.object({
  candidateIndex: z.number().int().nonnegative(),
  category: claimCategorySchema,
  capability: z.string().max(40),
  masteryPoints: z.array(masteryPointSchema).min(3).max(4),
  initialQuestion: z.string().max(120),
})
export type CompactClaim = z.infer<typeof compactClaimSchema>

export const compactAnalysisSchema = z.object({
  candidate: z.string(),
  role: z.string(),
  summary: z.string().max(100),
  claims: z.array(compactClaimSchema).min(3).max(4),
})
export type CompactAnalysis = z.infer<typeof compactAnalysisSchema>

export const llmResumeClaimSchema = z.object({
  content: z.string(),
  title: z.string(),
  category: claimCategorySchema,
  role: z.string(),
  sourceSection: z.string(),
  capability: z.string(),
  masteryPoints: z.array(masteryPointSchema).min(1),
  initialQuestion: z.string(),
  initialIntent: z.string().optional().default(''),
  trapPoints: z.array(z.string()).optional().default([]),
  testPriority: testPrioritySchema.optional().default('medium'),
})
export type LlmResumeClaim = z.infer<typeof llmResumeClaimSchema>

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
  claims: LlmResumeClaim[],
): ResumeClaim[] {
  return claims.map((claim, index) => ({
    ...claim,
    id: createClaimId(claim, index),
  }))
}

export function computeTestPriority(points: MasteryPoint[]): TestPriority {
  const highCount = points.filter((p) => p.importance === 'high').length
  if (highCount >= 3) return 'high'
  if (highCount >= 1) return 'medium'
  return 'low'
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
