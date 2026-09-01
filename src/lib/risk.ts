import type { ResumeClaim, TestPriority } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'

export type { TestPriority }

export type PriorityMeta = {
  level: TestPriority
  label: string
  description: string
  color: 'red' | 'amber' | 'green'
}

export const PRIORITY_META: Record<TestPriority, PriorityMeta> = {
  high: { level: 'high', label: '重点练习', description: '内容较多，面试时很可能被问到', color: 'red' },
  medium: { level: 'medium', label: '建议练习', description: '值得练一遍，可以按时间安排', color: 'amber' },
  low: { level: 'low', label: '有空再练', description: '内容比较清楚，可以稍后再练', color: 'green' },
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

// ── 简历要点进度派生（列表 / 摘要栏 / 侧栏徽标共用）────────────

export type ClaimStatus = 'done' | 'prepared' | 'todo'

export type ClaimProgress = {
  status: ClaimStatus
  latestScore: number | null
  /** 最近一次完成的练习已聊到的考察项数量 */
  covered: number
  /** 该简历要点的考察项总数 */
  total: number
}

/** “需加强”定义为最近一次得分不高于该阈值 */
export const WEAK_SCORE_THRESHOLD = 2

/** 合并用户修改后的练习顺序 */
export function effectivePriority(
  claim: ResumeClaim,
  overrides: Record<string, TestPriority>,
): TestPriority {
  return overrides[claim.id] ?? claim.testPriority
}

function latestDoneSession(
  sessions: InterviewSession[],
): InterviewSession | null {
  const done = sessions
    .filter((s) => s.status === 'done')
    .sort((a, b) => b.version - a.version)
  return done[0] ?? null
}

/** 一次算出全部简历要点的进度，返回以 claimId 为键的映射 */
export function summarizeClaimProgress(
  claims: ResumeClaim[],
  sessions: Record<string, InterviewSession[]>,
  preparedClaimIds: string[],
  overrides: Record<string, TestPriority> = {},
): Record<string, ClaimProgress> {
  void overrides
  const prepared = new Set(preparedClaimIds)
  const progress: Record<string, ClaimProgress> = {}
  for (const claim of claims) {
    const latest = latestDoneSession(sessions[claim.id] ?? [])
    const total = claim.masteryPoints.length
    progress[claim.id] = {
      status: latest ? 'done' : prepared.has(claim.id) ? 'prepared' : 'todo',
      latestScore: latest?.finalResult?.masteryScore ?? null,
      covered: latest?.rounds.at(-1)?.evaluation.coveredPoints.length ?? 0,
      total,
    }
  }
  return progress
}

/** 已练习内容的平均得分百分比（0-100）；一个都没练过时返回 null */
export function averageMasteryPct(
  progress: Record<string, ClaimProgress>,
): number | null {
  const scores = Object.values(progress)
    .map((p) => p.latestScore)
    .filter((s): s is number => s != null)
  if (scores.length === 0) return null
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length
  return Math.round((avg / 5) * 100)
}

/** 按调整后的顺序统计某一档的数量 */
export function priorityCount(
  claims: ResumeClaim[],
  overrides: Record<string, TestPriority>,
  level: TestPriority,
): number {
  return claims.filter((c) => effectivePriority(c, overrides) === level).length
}
