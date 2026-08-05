import type { ResumeClaim, TestPriority } from '@/domain/resume-schema'

export type { TestPriority }

export type PriorityMeta = {
  level: TestPriority
  label: string
  description: string
  color: 'red' | 'amber' | 'green'
}

export const PRIORITY_META: Record<TestPriority, PriorityMeta> = {
  high: { level: 'high', label: '优先测试', description: '掌握要点多，面试被问到概率高', color: 'red' },
  medium: { level: 'medium', label: '建议测试', description: '值得追问，可根据时间安排', color: 'amber' },
  low: { level: 'low', label: '可选测试', description: '能力点已较清晰，风险较低', color: 'green' },
}

export function claimPriority(claim: ResumeClaim): PriorityMeta {
  return PRIORITY_META[claim.testPriority]
}

export type AuditStats = {
  claimCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  totalMasteryPoints: number
}

export function computeStats(claims: ResumeClaim[]): AuditStats {
  if (claims.length === 0) {
    return { claimCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, totalMasteryPoints: 0 }
  }
  const byPrio = (level: TestPriority) => claims.filter((c) => c.testPriority === level).length
  const totalMasteryPoints = claims.reduce((sum, c) => sum + c.masteryPoints.length, 0)
  return {
    claimCount: claims.length,
    highCount: byPrio('high'),
    mediumCount: byPrio('medium'),
    lowCount: byPrio('low'),
    totalMasteryPoints,
  }
}
