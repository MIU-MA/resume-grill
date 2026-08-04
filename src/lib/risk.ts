import type { ResumeClaim, RiskLevel } from '@/domain/resume-schema'

export type { RiskLevel }

export type RiskMeta = {
  level: RiskLevel
  label: string
  color: 'red' | 'amber' | 'green'
  emoji: string
}

export const RISK_META: Record<RiskLevel, RiskMeta> = {
  high: { level: 'high', label: '高风险', color: 'red', emoji: '🔥' },
  medium: { level: 'medium', label: '中风险', color: 'amber', emoji: '⚠️' },
  low: { level: 'low', label: '较稳固', color: 'green', emoji: '✓' },
}

export function claimRisk(claim: ResumeClaim): RiskMeta {
  return RISK_META[claim.interviewRisk]
}

export type AuditStats = {
  claimCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  totalGaps: number
}

export function computeStats(claims: ResumeClaim[]): AuditStats {
  if (claims.length === 0) {
    return { claimCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, totalGaps: 0 }
  }
  const byRisk = (level: RiskLevel) => claims.filter((c) => c.interviewRisk === level).length
  const totalGaps = claims.reduce((sum, c) => sum + c.evidenceGap.length, 0)
  return {
    claimCount: claims.length,
    highCount: byRisk('high'),
    mediumCount: byRisk('medium'),
    lowCount: byRisk('low'),
    totalGaps,
  }
}
