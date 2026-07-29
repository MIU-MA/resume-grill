import type { ResumeClaim } from '@/domain/resume-schema'

// 风险三档：与旧 UI 的红 / 黄 / 绿视觉一致。
// 约定：verifiability 越高 = 越难自证 = 越红（高风险）。
export type Risk = 'high' | 'medium' | 'low'

export type RiskMeta = { level: Risk; label: string; color: 'red' | 'amber' | 'green' }

export function verifiabilityToRisk(verifiability: number): RiskMeta {
  if (verifiability >= 70) return { level: 'high', label: '高风险', color: 'red' }
  if (verifiability >= 40) return { level: 'medium', label: '需准备', color: 'amber' }
  return { level: 'low', label: '较稳固', color: 'green' }
}

export type AuditStats = {
  claimCount: number
  avgVerifiability: number
  highRiskCount: number
  totalGaps: number
}

export function computeStats(claims: ResumeClaim[]): AuditStats {
  if (claims.length === 0) {
    return { claimCount: 0, avgVerifiability: 0, highRiskCount: 0, totalGaps: 0 }
  }
  const avg = Math.round(claims.reduce((sum, c) => sum + c.verifiability, 0) / claims.length)
  const highRiskCount = claims.filter((c) => verifiabilityToRisk(c.verifiability).level === 'high').length
  const totalGaps = claims.reduce((sum, c) => sum + c.evidenceGaps.length, 0)
  return { claimCount: claims.length, avgVerifiability: avg, highRiskCount, totalGaps }
}
