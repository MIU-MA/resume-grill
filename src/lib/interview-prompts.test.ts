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
  exaggerationRisk: 'medium',
  interviewRisk: 'medium',
  evidenceGap: [],
  evidence: [],
  initialQuestion: '如何实现？',
  evaluationPoints: ['说明具体方案'],
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

  it('does not include full history, only accumulated state', () => {
    const rounds = [{
      action: 'answer' as const,
      question: 'Q1', questionIntent: 'test intent',
      answer: 'A1', annotation: '',
      evaluation: { score: 60, coveredPoints: ['P1'], missingPoints: ['P2'], answerSuggestion: '', evidenceQuotes: ['原文'] },
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
    expect(prompt).toContain('当前已覆盖')
    expect(prompt).toContain('P1')
    expect(prompt).not.toContain('得分60')
  })
})
