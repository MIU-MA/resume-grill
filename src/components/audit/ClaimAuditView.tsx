import { type ResumeAnalysis } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { ClaimList } from '@/components/audit/ClaimList'
import { ClaimDetail } from '@/components/audit/ClaimDetail'

export type ClaimStatus = 'done' | 'prepared' | 'todo'

type AuditViewProps = {
  analysis: ResumeAnalysis
  selectedIndex: number
  preparedClaimIds: string[]
  sessions: Record<string, InterviewSession[]>
  error: string | null
  onSelect: (index: number) => void
  onTogglePrepared: (claimId: string) => void
  onStartInterview: () => void
  onReport: () => void
}

export function ClaimAuditView({
  analysis,
  selectedIndex,
  preparedClaimIds,
  sessions,
  error,
  onSelect,
  onTogglePrepared,
  onStartInterview,
  onReport,
}: AuditViewProps) {
  const selected = analysis.claims[selectedIndex]

  const statusByClaim: Record<string, ClaimStatus> = {}
  const masteryByClaim: Record<string, number> = {}
  for (const claim of analysis.claims) {
    const latestDone = (sessions[claim.id] ?? [])
      .filter((s) => s.status === 'done')
      .sort((a, b) => b.version - a.version)[0]
    const hasDone = latestDone != null
    if (hasDone) masteryByClaim[claim.id] = latestDone.finalResult?.masteryScore ?? 0
    statusByClaim[claim.id] = hasDone
      ? 'done'
      : preparedClaimIds.includes(claim.id)
        ? 'prepared'
        : 'todo'
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)] gap-4 max-[1000px]:grid-cols-[280px_minmax(0,1fr)] max-[760px]:grid-cols-1">
      {error && (
        <div className="col-span-full bg-danger-soft border border-danger/20 rounded-xl px-5 py-3 text-[14px] text-danger">{error}</div>
      )}
      <aside className="h-full min-h-0 overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
        <ClaimList
          analysis={analysis}
          selectedIndex={selectedIndex}
          statusByClaim={statusByClaim}
          masteryByClaim={masteryByClaim}
          onSelect={onSelect}
          onTogglePrepared={onTogglePrepared}
          onReport={onReport}
        />
      </aside>
      <article className="h-full min-h-0 overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
        <ClaimDetail
          claim={selected}
          prepared={preparedClaimIds.includes(selected.id)}
          mastery={masteryByClaim[selected.id] ?? null}
          onReport={onReport}
          onTogglePrepared={() => onTogglePrepared(selected.id)}
          onStartInterview={onStartInterview}
        />
      </article>
    </div>
  )
}