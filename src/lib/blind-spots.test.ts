import { describe, expect, it } from 'vitest'
import { createBlindSpotId, deriveBlindSpots } from './blind-spots'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'

const analysis: ResumeAnalysis = {
  candidate: '张三', role: '后端开发', sourceFile: 'resume.txt', rawText: '负责接口幂等设计', summary: '',
  claims: [{
    id: 'claim-1', content: '负责接口幂等设计', title: '接口幂等', category: 'responsibility', role: '后端开发',
    sourceSection: '项目经历',
    capability: '接口幂等设计',
    masteryPoints: [{ point: '说明方案', dimension: 'practice', importance: 'high' }],
    initialQuestion: '怎么做的？',
    initialIntent: '',
    trapPoints: [],
    testPriority: 'medium',
  }],
}

const session: InterviewSession = {
  id: 'claim-1:v1', claimContent: '负责接口幂等设计', claimAnalysis: null, finalResult: null, status: 'done', version: 1,
  rounds: [{
    action: 'clarify',
    question: '如何保证接口幂等？', answer: '', annotation: '不理解幂等是什么意思', nextReason: '换一种问法',
    evaluation: { score: 0, coveredPoints: [], missingPoints: ['说明方案'], answerSuggestion: '同一个请求重复执行时，结果不会重复产生。' },
  }],
}

describe('blind spots', () => {
  it('derives a learning item from an interview annotation', () => {
    expect(deriveBlindSpots(analysis, { 'claim-1': [session] })).toEqual([
      expect.objectContaining({
        annotation: '不理解幂等是什么意思',
        question: '如何保证接口幂等？',
        explanation: '同一个请求重复执行时，结果不会重复产生。',
      }),
    ])
  })

  it('keeps IDs stable across whitespace differences', () => {
    expect(createBlindSpotId('claim-1', '不理解 幂等')).toBe(createBlindSpotId('claim-1', '不理解幂等'))
  })
})
