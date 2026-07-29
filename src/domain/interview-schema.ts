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
