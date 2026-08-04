import { z } from 'zod'
import { riskLevelSchema } from '@/domain/resume-schema'

export const verifyPointSchema = z.object({
  point: z.string(),
  importance: z.enum(['high', 'medium', 'low']),
})
export type VerifyPoint = z.infer<typeof verifyPointSchema>

export const claimAnalysisSchema = z.preprocess(
  (val) => {
    if (typeof val !== 'object' || val === null) return val
    const obj = val as Record<string, unknown>
    const rawPoints = Array.isArray(obj.verifyPoints) ? obj.verifyPoints : []
    return {
      level: obj.level || '通用',
      verifyPoints: rawPoints.map((vp: unknown) => {
        if (typeof vp !== 'object' || vp === null) return { point: String(vp), importance: 'medium' }
        const item = vp as Record<string, unknown>
        return {
          point: String(item.point ?? ''),
          importance: normalizeImportance(String(item.importance ?? 'medium')),
        }
      }),
      trapPoints: Array.isArray(obj.trapPoints) ? obj.trapPoints : [],
    }
  },
  z.object({
    level: z.string(),
    verifyPoints: z.array(verifyPointSchema).min(1),
    trapPoints: z.array(z.string()),
  }),
)

function normalizeImportance(value: string): 'high' | 'medium' | 'low' {
  const map: Record<string, 'high' | 'medium' | 'low'> = {
    high: 'high', medium: 'medium', low: 'low',
    '高': 'high', '中': 'medium', '低': 'low',
    '重要': 'high', '中等': 'medium', '一般': 'low',
  }
  return map[value] ?? 'medium'
}
export type ClaimAnalysis = z.infer<typeof claimAnalysisSchema>

export const interviewStartSchema = z.object({
  question: z.string(),
  intent: z.string(),
})
export type InterviewStart = z.infer<typeof interviewStartSchema>

export const interviewActionSchema = z.enum(['answer', 'clarify', 'skip'])
export type InterviewAction = z.infer<typeof interviewActionSchema>

export const interviewRoundSchema = z.object({
  action: interviewActionSchema.default('answer'),
  question: z.string(),
  answer: z.string(),
  annotation: z.string().default(''),
  evaluation: z.object({
    score: z.number().min(0).max(100),
    coveredPoints: z.array(z.string()),
    missingPoints: z.array(z.string()),
    answerSuggestion: z.string().default(''),
  }),
  nextReason: z.string(),
})
export type InterviewRound = z.infer<typeof interviewRoundSchema>

export const interviewContinueSchema = z.object({
  evaluation: z.object({
    score: z.number().min(0).max(100),
    coveredPoints: z.array(z.string()),
    missingPoints: z.array(z.string()),
    answerSuggestion: z.string().default(''),
  }),
  nextReason: z.string(),
  isFinal: z.boolean(),
  nextQuestion: z.string(),
})
export type InterviewContinueResult = z.infer<typeof interviewContinueSchema>

export const evaluateAnswerSchema = z.object({
  score: z.number().min(0).max(100),
  coveredPoints: z.array(z.string()),
  missingPoints: z.array(z.string()),
  answerSuggestion: z.string().default(''),
  evidenceQuotes: z.array(z.string()).default([]),
})
export type EvaluateAnswerResult = z.infer<typeof evaluateAnswerSchema>

export const generateFollowupSchema = z.object({
  nextReason: z.string(),
  isFinal: z.boolean(),
  nextQuestion: z.string(),
})
export type GenerateFollowupResult = z.infer<typeof generateFollowupSchema>

export const finalResultSchema = z.object({
  confidence: z.number().min(0).max(5),
  risk: riskLevelSchema,
  canExplain: z.array(z.string()),
  cannotExplain: z.array(z.string()),
  suggestions: z.array(z.string()),
  rewriteSuggestion: z.string(),
  answerSummary: z.string().default(''),
  evidenceUsed: z.array(z.string()).default([]),
  missingEvidence: z.array(z.string()).default([]),
  nextAction: z.string().default(''),
})
export type FinalResult = z.infer<typeof finalResultSchema>

export const interviewSessionSchema = z.object({
  id: z.string(),
  claimContent: z.string(),
  rounds: z.array(interviewRoundSchema),
  claimAnalysis: claimAnalysisSchema.nullable(),
  finalResult: finalResultSchema.nullable(),
  status: z.enum(['in_progress', 'done']),
  version: z.number().default(1),
  pendingQuestion: z.string().optional(),
  pendingIntent: z.string().optional(),
})
export type InterviewSession = z.infer<typeof interviewSessionSchema>
