import { expect, it } from 'vitest'
import { buildInterviewContext } from './interview-context'
import { interviewSessionSchema, finalResultSchema } from './interview-schema'
import type { KnowledgeItem } from './knowledge'

it('只带当前经历的复习记录，保留自报状态且不泄露其他经历笔记', () => {
  const item: KnowledgeItem = { id: '1', claimId: 'a', claimTitle: '缓存', source: 'manual', title: '缓存一致性', detail: '不应重复发送的模型解释', status: 'mastered', note: '复习过失效策略', createdAt: 1, updatedAt: 1 }
  expect(buildInterviewContext(' 负责缓存设计 ', [item, { ...item, claimId: 'b', note: '其他经历' }], 'a')).toEqual({ jobDescription: '负责缓存设计', reviewProgress: [{ topic: '缓存一致性', status: 'mastered', note: '复习过失效策略' }] })
  expect(buildInterviewContext(undefined, [], 'a')).toEqual({ jobDescription: '', reviewProgress: [] })
})
it('旧面试记录和旧复盘结果仍可读取，新反问字段会保留', () => {
  const result = { masteryScore: 2, canExplain: [], cannotExplain: [], rewriteSuggestion: '负责接口设计。' }
  expect(finalResultSchema.parse(result).interviewQuestions).toBeUndefined()
  const questions = [{ question: '这个岗位优先解决什么问题？', reason: '向用人经理了解目标', followUp: '先问当前约束，再考虑分享经历' }]
  const saved = interviewSessionSchema.parse({ id: 'a:v1', claimContent: '负责接口设计', rounds: [], claimAnalysis: null, finalResult: { ...result, interviewQuestions: questions }, status: 'done' })
  expect(saved.context).toBeUndefined()
  expect(saved.finalResult?.interviewQuestions).toEqual(questions)
})
