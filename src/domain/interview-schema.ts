import { z } from 'zod'
import { riskLevelSchema } from '@/domain/resume-schema'

// ── 声明分析 ──

export const verifyPointSchema = z.object({
  point: z.string(),
  importance: z.enum(['high', 'medium', 'low']),
})
export type VerifyPoint = z.infer<typeof verifyPointSchema>

// /api/analyze-claim 响应
export const claimAnalysisSchema = z.object({
  level: z.string(),
  verifyPoints: z.array(verifyPointSchema).min(1),
  trapPoints: z.array(z.string()),
})
export type ClaimAnalysis = z.infer<typeof claimAnalysisSchema>

// ── 面试流转 ──

// /api/interview/start 响应
export const interviewStartSchema = z.object({
  question: z.string(),
  intent: z.string(),
})
export type InterviewStart = z.infer<typeof interviewStartSchema>

// 一轮对话：问题 + 回答 + 评估
export const interviewRoundSchema = z.object({
  question: z.string(),
  answer: z.string(),
  evaluation: z.object({
    score: z.number().min(0).max(100),
    coveredPoints: z.array(z.string()),
    missingPoints: z.array(z.string()),
    answerSuggestion: z.string().default(''),
  }),
  nextReason: z.string(),
})
export type InterviewRound = z.infer<typeof interviewRoundSchema>

// /api/interview/continue 响应
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

// ── 风险报告 ──

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

// ── 会话持久化 ──

export const interviewSessionSchema = z.object({
  id: z.string(),
  claimContent: z.string(),
  rounds: z.array(interviewRoundSchema),
  claimAnalysis: claimAnalysisSchema.nullable(),
  finalResult: finalResultSchema.nullable(),
  status: z.enum(['in_progress', 'done']),
  version: z.number().default(1),
})
export type InterviewSession = z.infer<typeof interviewSessionSchema>
