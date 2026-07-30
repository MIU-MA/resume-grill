import { describe, it, expect } from 'vitest'
import { computeStats, RISK_META } from './risk'
import type { ResumeClaim } from '@/domain/resume-schema'

const claim = (interviewRisk: 'high' | 'medium' | 'low', gaps = 1): ResumeClaim => ({
  content: 'q',
  title: 't',
  category: 'achievement',
  role: '销售',
  sourceSection: '工作经历',
  exaggerationRisk: 'medium',
  interviewRisk,
  evidence: [],
  evidenceGap: Array.from({ length: gaps }, () => 'g'),
  initialQuestion: 'q',
  evaluationPoints: ['p1', 'p2'],
})

describe('RISK_META', () => {
  it('三档风险有正确的标签与颜色', () => {
    expect(RISK_META.high.color).toBe('red')
    expect(RISK_META.high.label).toBe('高风险')
    expect(RISK_META.medium.color).toBe('amber')
    expect(RISK_META.low.color).toBe('green')
  })
})

describe('computeStats', () => {
  it('空数组返回全零', () => {
    expect(computeStats([])).toEqual({
      claimCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      totalGaps: 0,
    })
  })
  it('按面试风险统计高中低数量与缺口数', () => {
    const stats = computeStats([claim('high', 1), claim('medium', 2), claim('low', 1)])
    expect(stats.claimCount).toBe(3)
    expect(stats.highCount).toBe(1)
    expect(stats.mediumCount).toBe(1)
    expect(stats.lowCount).toBe(1)
    expect(stats.totalGaps).toBe(4)
  })
})
