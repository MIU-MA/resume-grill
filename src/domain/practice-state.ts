import type { InterviewSession } from './interview-schema'

export function practiceState(claimId: string | undefined, sessions: InterviewSession[], active: { activeClaimSnapshot: { id: string } | null; currentQuestion: string; rounds: Array<{ action?: string }>; done: boolean }) {
  if (!claimId) return { state: 'unselected' as const, label: '选内容' }
  if (active.activeClaimSnapshot?.id === claimId && !active.done && active.currentQuestion) return { state: 'in_progress' as const, label: `继续第 ${active.rounds.filter(round => round.action === 'answer').length + 1} 轮` }
  const latest = [...sessions].sort((a, b) => b.version - a.version)[0]
  if (latest?.status === 'in_progress') return { state: 'in_progress' as const, label: `继续第 ${latest.rounds.filter(round => round.action === 'answer').length + 1} 轮` }
  if (latest?.status === 'done') return { state: 'completed' as const, label: '查看复盘' }
  return { state: 'selected' as const, label: '开始面试' }
}
