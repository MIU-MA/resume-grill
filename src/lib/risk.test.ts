import { describe, it, expect } from 'vitest'
import { claimRisk, computeStats } from './risk'
import type { ResumeClaim } from '@/domain/resume-schema'

const claim = (askLikelihood: number, evidenceStrength: number, gaps = 1): ResumeClaim => ({
  quote: 'q',
  title: 't',
  category: 'achievement',
  role: '销售',
  askLikelihood,
  evidenceStrength,
  evidence: [],
  evidenceGaps: Array.from({ length: gaps }, () => 'g'),
  initialQuestion: 'q',
  evaluationPoints: ['p1', 'p2'],
})

describe('claimRisk', () => {
  it('高追问概率 + 弱证据 -> high/red', () => {
    expect(claimRisk(85, 20)).toMatchObject({ level: 'high', color: 'red' })
  })
  it('中等组合 -> medium/amber', () => {
    expect(claimRisk(60, 60)).toMatchObject({ level: 'medium', color: 'amber' })
  })
  it('低追问概率或证据充分 -> low/green', () => {
    expect(claimRisk(30, 80)).toMatchObject({ level: 'low', color: 'green' })
  })
})

describe('computeStats', () => {
  it('空数组返回全零且不产生 NaN', () => {
    expect(computeStats([])).toEqual({
      claimCount: 0,
      avgAskLikelihood: 0,
      avgEvidenceStrength: 0,
      weakClaimCount: 0,
      totalGaps: 0,
    })
  })
  it('正确聚合均值、薄弱声明数与缺口数', () => {
    const stats = computeStats([claim(85, 20, 1), claim(30, 80, 2)])
    expect(stats.claimCount).toBe(2)
    expect(stats.avgAskLikelihood).toBe(58)
    expect(stats.avgEvidenceStrength).toBe(50)
    expect(stats.weakClaimCount).toBe(1)
    expect(stats.totalGaps).toBe(3)
  })
})
