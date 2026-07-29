import type { ResumeClaim } from '@/domain/resume-schema'

// 风险三档：与旧 UI 的红 / 黄 / 绿视觉一致。
// 拆分后用两个明确指标：askLikelihood（被追问概率）+ evidenceStrength（证据完整度）。
// 综合风险 = 被追问概率 × 证据缺口占比（证据越弱、被追问概率越高，越红）。
export type Risk = 'high' | 'medium' | 'low'

export type RiskMeta = { level: Risk; label: string; color: 'red' | 'amber' | 'green' }

// 综合风险分 0-100：被追问概率与证据缺口共同决定。
export function claimRiskScore(askLikelihood: number, evidenceStrength: number): number {
  return Math.round(askLikelihood * (1 - evidenceStrength / 100))
}

export function claimRisk(askLikelihood: number, evidenceStrength: number): RiskMeta {
  const score = claimRiskScore(askLikelihood, evidenceStrength)
  if (score >= 45) return { level: 'high', label: '高风险', color: 'red' }
  if (score >= 22) return { level: 'medium', label: '需准备', color: 'amber' }
  return { level: 'low', label: '较稳固', color: 'green' }
}

export type AuditStats = {
  claimCount: number
  avgAskLikelihood: number
  avgEvidenceStrength: number
  weakClaimCount: number
  totalGaps: number
}

export function computeStats(claims: ResumeClaim[]): AuditStats {
  if (claims.length === 0) {
    return { claimCount: 0, avgAskLikelihood: 0, avgEvidenceStrength: 0, weakClaimCount: 0, totalGaps: 0 }
  }
  const avgAsk = Math.round(claims.reduce((sum, c) => sum + c.askLikelihood, 0) / claims.length)
  const avgEvidence = Math.round(claims.reduce((sum, c) => sum + c.evidenceStrength, 0) / claims.length)
  const weakClaimCount = claims.filter((c) => claimRisk(c.askLikelihood, c.evidenceStrength).level === 'high').length
  const totalGaps = claims.reduce((sum, c) => sum + c.evidenceGaps.length, 0)
  return { claimCount: claims.length, avgAskLikelihood: avgAsk, avgEvidenceStrength: avgEvidence, weakClaimCount, totalGaps }
}
