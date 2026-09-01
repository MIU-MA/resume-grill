import { useMemo, useState } from 'react'
import { Bookmark, Check } from 'lucide-react'
import {
  CLAIM_CATEGORY_LABELS,
  type ResumeAnalysis,
  type TestPriority,
} from '@/domain/resume-schema'
import { ClaimBatchActions } from '@/components/audit/ClaimBatchActions'
import { ClaimListToolbar } from '@/components/audit/ClaimListToolbar'
import type { ClaimFilter } from '@/components/audit/claim-list-types'
import { WEAK_SCORE_THRESHOLD, type ClaimProgress } from '@/lib/risk'

type Props = {
  analysis: ResumeAnalysis
  selectedIndex: number
  progressByClaim: Record<string, ClaimProgress>
  claimPriorityOverrides: Record<string, TestPriority>
  onSelect: (index: number) => void
  onTogglePrepared: (id: string) => void
  onReport: () => void
  onBatchTogglePrepared: (ids: string[]) => void
  onSetClaimsPriority: (ids: string[], priority: TestPriority) => void
}

const STATUS_LABEL = {
  done: '已练习',
  prepared: '已准备',
  todo: '未练习',
} as const

const PRIORITY_BORDER: Record<TestPriority, string> = {
  high: 'border-danger',
  medium: 'border-warning',
  low: 'border-line-strong',
}

export function ClaimList({
  analysis,
  selectedIndex,
  progressByClaim,
  claimPriorityOverrides,
  onSelect,
  onTogglePrepared,
  onReport,
  onBatchTogglePrepared,
  onSetClaimsPriority,
}: Props) {
  const [filter, setFilter] = useState<ClaimFilter>('all')
  const [multi, setMulti] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const visible = useMemo(
    () =>
      analysis.claims
        .map((claim, index) => ({ claim, index }))
        .filter(({ claim }) => {
          const progress = progressByClaim[claim.id]
          const priority =
            claimPriorityOverrides[claim.id] ?? claim.testPriority

          if (filter === 'high') return priority === 'high'
          if (filter === 'untested') return progress.status === 'todo'
          if (filter === 'weak') {
            return (
              progress.latestScore !== null &&
              progress.latestScore <= WEAK_SCORE_THRESHOLD
            )
          }
          return true
        }),
    [analysis.claims, claimPriorityOverrides, filter, progressByClaim],
  )

  const toggleSelected = (claimId: string) => {
    setSelectedIds((ids) =>
      ids.includes(claimId)
        ? ids.filter((id) => id !== claimId)
        : [...ids, claimId],
    )
  }

  const leaveMultiSelect = () => {
    setMulti(false)
    setSelectedIds([])
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ClaimListToolbar
        filter={filter}
        multi={multi}
        onFilterChange={(nextFilter) => {
          setFilter(nextFilter)
          setSelectedIds([])
        }}
        onToggleMulti={() => {
          if (multi) leaveMultiSelect()
          else setMulti(true)
        }}
      />

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {visible.map(({ claim, index }) => {
          const progress = progressByClaim[claim.id]
          const active = index === selectedIndex
          const checked = selectedIds.includes(claim.id)
          const priority =
            claimPriorityOverrides[claim.id] ?? claim.testPriority

          return (
            <div
              key={claim.id}
              className={`flex items-center gap-2 border-l-[3px] px-2 py-2 ${
                active && !multi
                  ? 'border-brand bg-brand-soft'
                  : `${PRIORITY_BORDER[priority]} hover:bg-surface-hover`
              }`}
            >
              {multi && (
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSelected(claim.id)}
                  aria-label={`选择 ${claim.title}`}
                />
              )}
              <button
                type="button"
                onClick={() =>
                  multi ? toggleSelected(claim.id) : onSelect(index)
                }
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium">
                    {claim.content}
                  </span>
                  {progress.status === 'done' ? (
                    <Check size={14} className="flex-none text-success" />
                  ) : progress.status === 'prepared' ? (
                    <Bookmark
                      size={14}
                      className="flex-none text-text-tertiary"
                    />
                  ) : null}
                </span>
                <span className="mt-1 block truncate text-[11px] text-text-tertiary">
                  {CLAIM_CATEGORY_LABELS[claim.category]} · {claim.capability} ·{' '}
                  {progress.status === 'done'
                    ? `${progress.covered}/${progress.total} · 得分 ${progress.latestScore}/5`
                    : STATUS_LABEL[progress.status]}
                </span>
              </button>
              {!multi && progress.status === 'prepared' && (
                <button
                  type="button"
                  onClick={() => onTogglePrepared(claim.id)}
                  className="text-[11px] text-text-tertiary hover:text-text-primary"
                >
                  取消
                </button>
              )}
              {!multi && progress.status === 'done' && (
                <button
                  type="button"
                  onClick={onReport}
                  className="text-[11px] text-brand"
                >
                  复盘
                </button>
              )}
            </div>
          )
        })}
        {visible.length === 0 && (
          <p className="px-3 py-8 text-center text-[12px] text-text-tertiary">
            没有符合当前筛选的简历要点
          </p>
        )}
      </div>

      {multi && (
        <ClaimBatchActions
          selectedIds={selectedIds}
          onMarkPrepared={() => {
            onBatchTogglePrepared(selectedIds)
            setSelectedIds([])
          }}
          onSetPriority={(priority) => {
            onSetClaimsPriority(selectedIds, priority)
            setSelectedIds([])
          }}
          onExit={leaveMultiSelect}
        />
      )}
    </div>
  )
}
