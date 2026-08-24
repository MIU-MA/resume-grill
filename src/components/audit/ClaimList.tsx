import { useState } from 'react'
import { Bookmark, Check } from 'lucide-react'
import { CLAIM_CATEGORY_LABELS, type ResumeAnalysis, type TestPriority } from '@/domain/resume-schema'
import type { ClaimStatus } from '@/components/audit/ClaimAuditView'

const PRIORITY_FILTERS: { label: string; value: TestPriority | 'all' }[] = [
  { label: '全部', value: 'all' },
  { label: '优先测试', value: 'high' },
  { label: '建议测试', value: 'medium' },
  { label: '可选测试', value: 'low' },
]

const STATUS_FILTERS: { label: string; value: ClaimStatus | 'all' }[] = [
  { label: '全部', value: 'all' },
  { label: '待测试', value: 'todo' },
  { label: '已准备', value: 'prepared' },
  { label: '已完成', value: 'done' },
]

const STATUS_LABEL: Record<ClaimStatus, string> = {
  done: '已完成',
  prepared: '已准备',
  todo: '待测试',
}

const STATUS_CLS: Record<ClaimStatus, string> = {
  done: 'bg-success-soft text-success',
  prepared: 'bg-brand-soft text-brand',
  todo: 'bg-surface-hover text-text-tertiary',
}

type ClaimListProps = {
  analysis: ResumeAnalysis
  selectedIndex: number
  statusByClaim: Record<string, ClaimStatus>
  masteryByClaim: Record<string, number>
  onSelect: (index: number) => void
  onTogglePrepared: (claimId: string) => void
  onReport: () => void
}

export function ClaimList({ analysis, selectedIndex, statusByClaim, masteryByClaim, onSelect, onTogglePrepared, onReport }: ClaimListProps) {
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<TestPriority | 'all'>('all')

  const visible = analysis.claims
    .map((claim, originalIndex) => ({ claim, originalIndex }))
    .filter(({ claim }) => {
      if (statusFilter !== 'all' && statusByClaim[claim.id] !== statusFilter) return false
      if (priorityFilter !== 'all' && claim.testPriority !== priorityFilter) return false
      return true
    })

  const statusLabel = statusFilter === 'all' ? '全部状态' : STATUS_LABEL[statusFilter]

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* 头部：标题 + 筛选 */}
      <div className="px-3.5 pt-[14px] pb-2 border-b border-line flex-none">
        <div className="flex items-baseline justify-between gap-2 mb-2.5">
          <div className="text-[15px] font-bold">能力清单</div>
          <div className="text-text-tertiary text-[12px]">{statusLabel} · {visible.length} 条</div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 overflow-x-auto">
            {STATUS_FILTERS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`flex-none rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-brand-soft text-brand'
                    : 'bg-transparent text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <select
            className="ml-auto h-[26px] flex-none text-[11px] border border-line rounded-md bg-white text-text-secondary px-1.5 cursor-pointer"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TestPriority | 'all')}
            aria-label="按优先级筛选"
          >
            {PRIORITY_FILTERS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scroll-smooth">
        {visible.length === 0 ? (
          <div className="text-center text-text-tertiary text-[13px] py-10">没有匹配的声明</div>
        ) : (
          visible.map(({ claim, originalIndex }) => {
            const status = statusByClaim[claim.id] ?? 'todo'
            const mastery = masteryByClaim[claim.id]
            const isActive = originalIndex === selectedIndex
            const isDone = status === 'done'
            return (
              <div
                key={claim.id}
                className={`flex items-stretch rounded-[10px] border transition-colors overflow-hidden ${
                  isActive
                    ? 'border-brand/30 bg-brand-soft shadow-[inset_2px_0_0_#2563eb]'
                    : 'border-transparent hover:border-line hover:bg-surface-soft'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(originalIndex)}
                  className="min-w-0 flex-1 px-3 py-3 text-left"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLS[status]}`}>
                      {isDone ? <Check size={10} /> : null}
                      {STATUS_LABEL[status]}
                    </span>
                    {isDone && mastery != null && (
                      <span className="text-[11px] font-semibold text-success">掌握 {mastery}/5</span>
                    )}
                  </div>
                  <p className="text-[13px] leading-[1.5] text-text-primary line-clamp-2">{claim.content}</p>
                  <div className="mt-1.5 text-[11px] text-text-tertiary truncate">
                    {CLAIM_CATEGORY_LABELS[claim.category]} · {claim.capability}
                  </div>
                </button>

                {/* 右侧操作列：已准备书签 + 查看报告 */}
                <div className="flex flex-none flex-col items-center justify-between gap-2 py-2.5 pr-2">
                  <button
                    type="button"
                    onClick={() => onTogglePrepared(claim.id)}
                    className="grid size-7 place-items-center rounded-md transition-colors hover:bg-brand-soft"
                    title={status === 'prepared' ? '取消已准备' : '加入准备计划'}
                    aria-label={status === 'prepared' ? '取消已准备' : '加入准备计划'}
                    aria-pressed={status === 'prepared'}
                  >
                    <Bookmark size={14} className={`${status === 'prepared' ? 'fill-brand text-brand' : 'text-text-tertiary'}`} />
                  </button>
                  {isDone && (
                    <button
                      type="button"
                      onClick={onReport}
                      className="text-[11px] font-semibold text-brand hover:underline"
                      title="查看该声明的测试报告"
                    >
                      报告
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}