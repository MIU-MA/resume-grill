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
    expect(prompt).toContain('用户的不懂批注: 不理解幂等是什么意思')
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
    expect(prompt).toContain('操作类型: 已掌握，跳过（未验证）')
  })
})
