import { describe, expect, it } from 'vitest'
import { buildInterviewContinueUser } from './interview-prompts'
import type { ResumeClaim } from '@/domain/resume-schema'

const claim: ResumeClaim = {
  id: 'claim-1',
  content: '负责接口幂等设计。',
  title: '接口幂等',
  category: 'responsibility',
  role: '后端开发',
  sourceSection: '项目经历',
  capability: '接口幂等设计',
  masteryPoints: [{ point: '说明具体方案', dimension: 'practice', importance: 'high' }],
  initialQuestion: '如何实现？',
  initialIntent: '',
  trapPoints: [],
  testPriority: 'medium',
}

describe('interview prompts', () => {
  it('passes an annotation separately from the answer', () => {
    const prompt = buildInterviewContinueUser(
      claim,
      '如何保证接口幂等？',
      '',
      '不理解幂等是什么意思',
      'clarify',
      [],
      [{ point: '说明具体方案', importance: 'high' }],
      [],
    )
    expect(prompt).toContain('答: (未作答)')
    expect(prompt).toContain('不懂: 不理解幂等是什么意思')
  })

  it('marks skipped questions as self-reported and unverified', () => {
    const prompt = buildInterviewContinueUser(
      claim,
      '如何保证接口幂等？',
      '',
      '',
      'skip',
      [],
      [{ point: '说明具体方案', importance: 'high' }],
      [],
    )
    expect(prompt).toContain('操作: 已掌握，跳过（未验证）')
  })

  it('includes compressed conversation history so follow-ups build on it', () => {
    const rounds = [{
      action: 'answer' as const,
      question: '如何保证接口幂等？', questionIntent: 'test intent',
      answer: '用了乐观锁和版本号。', annotation: '',
      evaluation: { score: 60, coveredPoints: ['说明具体方案'], missingPoints: [], answerSuggestion: '', evidenceQuotes: ['原文'] },
      nextReason: '追问',
    }]
    const prompt = buildInterviewContinueUser(
      claim,
      '第二个问题？',
      '我的回答',
      '',
      'answer',
      rounds,
      [{ point: '说明具体方案', importance: 'high' }],
      ['只说概念'],
    )
    expect(prompt).toContain('历史追问：')
    expect(prompt).toContain('第 1 轮')
    expect(prompt).toContain('问: 如何保证接口幂等？')
    expect(prompt).toContain('答: 用了乐观锁和版本号。')
    expect(prompt).toContain('已验证: 说明具体方案')
    expect(prompt).toContain('仍缺失: (无)')
  })

  it('truncates very long answers in history to bound token usage', () => {
    const longAnswer = 'x'.repeat(1000)
    const rounds = [{
      action: 'answer' as const,
      question: 'Q1', questionIntent: '',
      answer: longAnswer, annotation: '',
      evaluation: { score: 60, coveredPoints: [], missingPoints: [], answerSuggestion: '', evidenceQuotes: [] },
      nextReason: '追问',
    }]
    const prompt = buildInterviewContinueUser(
      claim,
      'Q2', 'A2', '',
      'answer',
      rounds,
      [],
      [],
    )
    expect(prompt).toContain('…（截断）')
    // 400 字符上限 + 截断标识
    expect(prompt).not.toContain('x'.repeat(500))
  })
})
