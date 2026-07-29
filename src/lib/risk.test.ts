import { describe, it, expect } from 'vitest'
import { verifiabilityToRisk, computeStats } from './risk'
import type { ResumeClaim } from '@/domain/resume-schema'

const claim = (verifiability: number, gaps = 1): ResumeClaim => ({
  quote: 'q',
  title: 't',
  category: 'achievement',
  role: '销售',
  verifiability,
  evidence: [],
  evidenceGaps: Array.from({ length: gaps }, () => 'g'),
  initialQuestion: 'q',
  evaluationPoints: ['p1', 'p2'],
})

describe('verifiabilityToRisk', () => {
  it('高可验证难度映射为 high/red', () => {
    expect(verifiabilityToRisk(80)).toMatchObject({ level: 'high', color: 'red' })
  })
  it('中等映射为 medium/amber', () => {
    expect(verifiabilityToRisk(50)).toMatchObject({ level: 'medium', color: 'amber' })
  })
  it('低映射为 low/green', () => {
    expect(verifiabilityToRisk(20)).toMatchObject({ level: 'low', color: 'green' })
  })
})

describe('computeStats', () => {
  it('空数组返回全零且不产生 NaN', () => {
    expect(computeStats([])).toEqual({
      claimCount: 0,
      avgVerifiability: 0,
      highRiskCount: 0,
      totalGaps: 0,
    })
  })
  it('正确聚合均值、高风险数与缺口数', () => {
    const stats = computeStats([claim(80, 1), claim(20, 2)])
    expect(stats.claimCount).toBe(2)
    expect(stats.avgVerifiability).toBe(50)
    expect(stats.highRiskCount).toBe(1)
    expect(stats.totalGaps).toBe(3)
  })
})
