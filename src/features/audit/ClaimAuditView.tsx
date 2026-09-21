import type { ResumeAnalysis, TestPriority } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { ClaimList } from '@/features/audit/ClaimList'
import { ClaimDetail } from '@/features/audit/ClaimDetail'
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
      <div className="flex-none border-b border-line px-5 py-3 text-[12px] text-text-secondary">选择要练习的经历，梳理回答要点。共 {analysis.claims.length} 项，已准备 {preparedClaimIds.length} 项。</div>
      {error && (
        <div className="mx-4 mt-3 rounded-lg bg-danger-soft px-4 py-2 text-[13px] text-danger">
          {error}
        </div>
      )}
      <div className="grid min-h-0 w-full flex-1 grid-cols-[clamp(260px,27%,clamp(320px,15vw,380px))_minmax(0,1fr)] max-[760px]:block max-[760px]:overflow-y-auto">
        <aside className="min-h-0 overflow-hidden border-r border-line bg-surface-soft max-[760px]:h-[300px] max-[760px]:border-b max-[760px]:border-r-0">
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
        <article className="min-h-0 overflow-hidden bg-white max-[760px]:overflow-visible">
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
