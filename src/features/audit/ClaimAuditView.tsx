import type { ResumeAnalysis, TestPriority } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { ClaimList } from '@/features/audit/ClaimList'
import { ClaimDetail } from '@/features/audit/ClaimDetail'
import { SummaryBar } from '@/features/audit/SummaryBar'
import type { ClaimProgress } from '@/lib/risk'

type Props = {
  analysis: ResumeAnalysis
  selectedIndex: number
  preparedClaimIds: string[]
  sessions: Record<string, InterviewSession[]>
  error: string | null
  progressByClaim: Record<string, ClaimProgress>
  claimPriorityOverrides: Record<string, TestPriority>
  onSelect: (index: number) => void
  onTogglePrepared: (id: string) => void
  onStartInterview: () => void
  onReport: () => void
  onSetClaimsPriority: (ids: string[], priority: TestPriority) => void
  onBatchTogglePrepared: (ids: string[]) => void
}

export function ClaimAuditView({
  analysis,
  selectedIndex,
  preparedClaimIds,
  sessions,
  error,
  progressByClaim,
  claimPriorityOverrides,
  onSelect,
  onTogglePrepared,
  onStartInterview,
  onReport,
  onSetClaimsPriority,
  onBatchTogglePrepared,
}: Props) {
  const selected = analysis.claims[selectedIndex]

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SummaryBar
        claims={analysis.claims}
        progress={progressByClaim}
        overrides={claimPriorityOverrides}
      />
      {error && (
        <div className="mx-4 mt-3 rounded-lg bg-danger-soft px-4 py-2 text-[13px] text-danger">
          {error}
        </div>
      )}
      <div className="mx-auto grid min-h-0 w-full max-w-[1320px] flex-1 grid-cols-[320px_minmax(0,1fr)] gap-3 px-3 py-3 sm:px-4 md:gap-4 md:px-5 md:py-4 max-[1040px]:grid-cols-[280px_minmax(0,1fr)] max-[760px]:block max-[760px]:overflow-y-auto">
        <aside className="min-h-0 overflow-hidden rounded-lg bg-white shadow-card ring-1 ring-black/[0.03] max-[760px]:h-[380px]">
          <ClaimList
            analysis={analysis}
            selectedIndex={selectedIndex}
            progressByClaim={progressByClaim}
            claimPriorityOverrides={claimPriorityOverrides}
            onSelect={onSelect}
            onTogglePrepared={onTogglePrepared}
            onReport={onReport}
            onBatchTogglePrepared={onBatchTogglePrepared}
            onSetClaimsPriority={onSetClaimsPriority}
          />
        </aside>
        <article className="min-h-0 overflow-hidden rounded-lg bg-white shadow-card ring-1 ring-black/[0.03] max-[760px]:mt-3 max-[760px]:overflow-visible">
          <ClaimDetail
            claim={selected}
            priority={
              claimPriorityOverrides[selected.id] ?? selected.testPriority
            }
            prepared={preparedClaimIds.includes(selected.id)}
            mastery={progressByClaim[selected.id]?.latestScore ?? null}
            progress={progressByClaim[selected.id]}
            historySessions={sessions[selected.id] ?? []}
            onReport={onReport}
            onTogglePrepared={() => onTogglePrepared(selected.id)}
            onStartInterview={onStartInterview}
            onSetPriority={(priority) =>
              onSetClaimsPriority([selected.id], priority)
            }
          />
        </article>
      </div>
    </div>
  )
}
