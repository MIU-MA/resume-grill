import type {
  ResumeAnalysis,
  ResumeClaim,
  TestPriority,
} from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { effectivePriority } from '@/lib/risk'

export type ReportTopAction = {
  id: string
  kind: 'untested-high' | 'weak-claim' | 'blind-spot'
  /** 展示主文案 */
  title: string
  /** 一句话理由 */
  reason: string
  /** blind-spot 聚合项可为 null */
  claimId: string | null
}

type ClaimSessions = Record<string, InterviewSession[]>

function latestDone(sessions: InterviewSession[]) {
  const done = sessions
    .filter((s) => s.status === 'done')
    .sort((a, b) => b.version - a.version)
  return done[0] ?? null
}

/**
 * 报告页「最需要处理的 3 件事」：
 * ① 还没练过的重点内容（最多 2 条）
 * ② 已练过但得分最低、且仍有没说清楚的内容（1 条）
 * ③ 仍有待复习内容时给出一条聚合项
 * 依次添加直到凑满 limit（不足则少给）。
 */
export function deriveTopActions(
  analysis: ResumeAnalysis,
  sessions: ClaimSessions,
  masteredBlindSpotIds: string[],
  limit = 3,
  priorityOverrides: Record<string, TestPriority> = {},
): ReportTopAction[] {
  const actions: ReportTopAction[] = []

  let untestedUsed = 0
  for (const claim of analysis.claims) {
    if (untestedUsed >= 2 || actions.length >= limit) break
    const list = sessions[claim.id] ?? []
    const hasDone = list.some((s) => s.status === 'done')
    if (hasDone) continue
    if (effectivePriority(claim, priorityOverrides) !== 'high') continue
    actions.push({
      id: `untested-high-${claim.id}`,
      kind: 'untested-high',
      title: claim.title,
      reason: '这是重点内容，但还没练过',
      claimId: claim.id,
    })
    untestedUsed++
  }

  if (actions.length < limit) {
    const weak = analysis.claims
      .map((claim) => {
        const latest = latestDone(sessions[claim.id] ?? [])
        return {
          claim,
          score: latest?.finalResult?.masteryScore ?? null,
          cannotExplain: latest?.finalResult?.cannotExplain ?? [],
        }
      })
      .filter(
        (c): c is { claim: ResumeClaim; score: number; cannotExplain: string[] } =>
          c.score != null && c.cannotExplain.length > 0,
      )
      .sort((a, b) => a.score - b.score)[0]
    if (weak) {
      actions.push({
        id: `weak-claim-${weak.claim.id}`,
        kind: 'weak-claim',
        title: weak.claim.title,
        reason: `得分 ${weak.score}/5，还有没说清楚的地方`,
        claimId: weak.claim.id,
      })
    }
  }

  const blindSpots = analysis.claims.reduce((count, claim) => {
    const list = sessions[claim.id] ?? []
    return (
      count +
      list.reduce(
        (n, s) =>
          n +
          s.rounds.filter((r) => r.annotation.trim().length > 0).length,
        0,
      )
    )
  }, 0)
  const unresolved = Math.max(0, blindSpots - masteredBlindSpotIds.length)

  if (actions.length < limit && unresolved > 0) {
    actions.push({
      id: 'blind-spot-collective',
      kind: 'blind-spot',
      title: `还有 ${unresolved} 条内容要复习`,
      reason: '逐条复习，或者再练一次',
      claimId: null,
    })
  }

  return actions
}
