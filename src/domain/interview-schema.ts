import { z } from 'zod'

// 一轮对话：面试官提问 + 候选人回答
export const interviewTurnSchema = z.object({
  question: z.string(),
  answer: z.string(),
})
export type InterviewTurn = z.infer<typeof interviewTurnSchema>

// /api/interview 的响应：根据上一轮回答动态生成的下一问
export const nextQuestionSchema = z.object({
  // 下一问的题目
  question: z.string(),
  // 这一问在验证什么
  intent: z.string(),
  // 是否结束本轮追问
  isFinal: z.boolean(),
  // 截至目前，回答已经覆盖的评估要点
  coveredPoints: z.array(z.string()),
  // 仍然缺失、建议补充的要点
  missingPoints: z.array(z.string()),
})
export type NextQuestion = z.infer<typeof nextQuestionSchema>

// /api/summarize 的响应：一轮追问结束后的结论与改写建议
export const sessionSummarySchema = z.object({
  finalSummary: z.string(),
  rewriteSuggestion: z.string(),
})
export type SessionSummary = z.infer<typeof sessionSummarySchema>

// 单条声明的完整面试会话：在内存与 IndexedDB 中保存，退出后可恢复。
export const interviewSessionSchema = z.object({
  // 关联的声明 quote（作为 claimId，避免引入额外 id）
  claimId: z.string(),
  turns: z.array(interviewTurnSchema),
  coveredPoints: z.array(z.string()),
  missingPoints: z.array(z.string()),
  finalSummary: z.string(),
  rewriteSuggestion: z.string(),
  // 进行中 / 已完成
  status: z.enum(['in_progress', 'done']),
})
export type InterviewSession = z.infer<typeof interviewSessionSchema>
