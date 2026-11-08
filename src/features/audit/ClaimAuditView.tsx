'use client'
import { useEffect } from 'react'
import type { ResumeAnalysis, TestPriority } from '@/domain/resume-schema'
import { ClaimList } from '@/features/audit/ClaimList'
import { ClaimDetail } from '@/features/audit/ClaimDetail'
import type { ClaimProgress } from '@/domain/risk'

type Props = {
  analysis: ResumeAnalysis
  selectedIndex: number
  preparedClaimIds: string[]
  error: string | null
  progressByClaim: Record<string, ClaimProgress>
  claimPriorityOverrides: Record<string, TestPriority>
  onSelect: (index: number) => void
  onTogglePrepared: (id: string) => void
  onStartInterview: () => void
  canContinueInterview: boolean
  interviewLoading: boolean
  interviewActionLabel?: string
  onReport: () => void
  onSetClaimsPriority: (ids: string[], priority: TestPriority) => void
  onBatchTogglePrepared: (ids: string[]) => void
}

export function ClaimAuditView({
  analysis,
  selectedIndex,
  preparedClaimIds,
  error,
  progressByClaim,
  claimPriorityOverrides,
  onSelect,
  onTogglePrepared,
  onStartInterview,
  canContinueInterview,
  interviewLoading,
  interviewActionLabel,
  onReport,
  onSetClaimsPriority,
  onBatchTogglePrepared,
}: Props) {
  const selected = analysis.claims[selectedIndex] ?? analysis.claims[0]
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (!selected || interviewLoading || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
      if ((event.target as HTMLElement | null)?.closest('input, textarea, select, button, [contenteditable="true"], [role="dialog"], dialog')) return
      if (document.querySelector('[role="dialog"][aria-modal="true"], dialog[open]')) return
      const index = analysis.claims.indexOf(selected)
      if (event.key === 'ArrowDown' || event.key.toLowerCase() === 'j') { event.preventDefault(); if (index < analysis.claims.length - 1) onSelect(index + 1) }
      else if (event.key === 'ArrowUp' || event.key.toLowerCase() === 'k') { event.preventDefault(); if (index > 0) onSelect(index - 1) }
      else if (event.key === ' ') { event.preventDefault(); onTogglePrepared(selected.id) }
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  }, [analysis.claims, selected, interviewLoading, onSelect, onTogglePrepared])
  if (!selected) return <p role="status" className="p-5 text-body text-text-secondary">还没有可练习的内容，请重新选择简历或准备内容。</p>
  const resolvedIndex = analysis.claims.indexOf(selected)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-none border-b border-line px-5 py-3 text-body text-text-secondary">选一段经历开始练习。共 {analysis.claims.length} 项。</div>
      <label className="hidden border-b border-line p-3 text-label max-[760px]:block">当前练习内容
        <select className="mt-2 w-full" value={resolvedIndex} onChange={event => onSelect(Number(event.target.value))}>
          {analysis.claims.map((claim, index) => <option key={claim.id} value={index}>{index + 1}. {claim.capability || claim.title}</option>)}
        </select>
      </label>
      {error && (
        <div role="alert" className="mx-4 mt-3 bg-danger-soft px-4 py-2 text-body text-danger">
          {error}
        </div>
      )}
      <div className="grid min-h-0 w-full flex-1 grid-cols-[minmax(260px,340px)_minmax(0,1fr)] max-[760px]:block max-[760px]:overflow-y-auto">
        <aside className="min-h-0 overflow-hidden border-r border-line bg-surface-soft max-[760px]:hidden">
          <ClaimList
            analysis={analysis}
            selectedIndex={resolvedIndex}
            progressByClaim={progressByClaim}
            claimPriorityOverrides={claimPriorityOverrides}
            onSelect={onSelect}
            onTogglePrepared={onTogglePrepared}
            onReport={onReport}
            onBatchTogglePrepared={onBatchTogglePrepared}
            onSetClaimsPriority={onSetClaimsPriority}
          />
        </aside>
        <article className="min-h-0 overflow-hidden bg-surface max-[760px]:overflow-visible">
          <ClaimDetail
            claim={selected}
            priority={
              claimPriorityOverrides[selected.id] ?? selected.testPriority
            }
            prepared={preparedClaimIds.includes(selected.id)}
            mastery={progressByClaim[selected.id]?.latestScore ?? null}
            progress={progressByClaim[selected.id]}
            onReport={onReport}
            onTogglePrepared={() => onTogglePrepared(selected.id)}
            onStartInterview={onStartInterview}
            canContinueInterview={canContinueInterview}
            interviewLoading={interviewLoading}
            interviewActionLabel={interviewActionLabel}
            onSetPriority={(priority) =>
              onSetClaimsPriority([selected.id], priority)
            }
          />
        </article>
      </div>
    </div>
  )
}
