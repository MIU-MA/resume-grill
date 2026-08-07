import { useState } from 'react'
import { Check } from 'lucide-react'
import { CLAIM_CATEGORY_LABELS, type ResumeAnalysis, type TestPriority } from '@/domain/resume-schema'
import { PRIORITY_META } from '@/lib/risk'

const FILTER_OPTIONS: { label: string; value: TestPriority | 'all' }[] = [
  { label: '全部声明', value: 'all' },
  { label: '优先测试', value: 'high' },
  { label: '建议测试', value: 'medium' },
  { label: '可选测试', value: 'low' },
]

const PRIORITY_CLS: Record<string, string> = {
  high: 'text-danger bg-danger-soft [&::before]:bg-danger',
  medium: 'text-warning bg-warning-soft [&::before]:bg-warning',
  low: 'text-success bg-success-soft [&::before]:bg-success',
}

type ClaimListProps = {
  analysis: ResumeAnalysis
  selectedIndex: number
  preparedClaimIds: string[]
  completedClaimIds: string[]
  onSelect: (index: number) => void
}

export function ClaimList({ analysis, selectedIndex, preparedClaimIds, completedClaimIds, onSelect }: ClaimListProps) {
  const [filter, setFilter] = useState<TestPriority | 'all'>('all')

  const visible = analysis.claims
    .map((claim, originalIndex) => ({ claim, originalIndex }))
    .filter(({ claim }) => filter === 'all' || claim.testPriority === filter)

  const currentFilterLabel = filter === 'all' ? '全部声明' : PRIORITY_META[filter].label

  return (
    <div className="flex flex-col max-h-[650px]">
      <div className="flex items-center justify-between px-5 py-[18px] border-b border-border flex-none">
        <div>
          <div className="text-[15px] font-bold">能力清单</div>
          <div className="text-text-tertiary text-[12px] mt-1">
            {currentFilterLabel} · {visible.length} 条
          </div>
        </div>
        <select
          className="h-[34px] text-[12px] border border-border rounded-lg bg-white text-text-secondary px-2.5 cursor-pointer"
          value={filter}
          onChange={(e) => setFilter(e.target.value as TestPriority | 'all')}
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scroll-smooth">
        {visible.length === 0 ? (
          <div className="text-center text-text-tertiary text-[13px] py-12">没有匹配的声明</div>
        ) : (
          visible.map(({ claim, originalIndex }) => {
            const prio = PRIORITY_META[claim.testPriority]
            const isActive = originalIndex === selectedIndex
            return (
              <button
                key={claim.id}
                type="button"
                onClick={() => onSelect(originalIndex)}
                className={`w-full text-left rounded-[10px] px-3 py-3 transition-colors block border ${isActive ? 'border-brand/30 bg-brand-soft shadow-[inset_3px_0_0_#2563eb]' : 'border-transparent bg-transparent hover:bg-surface-soft hover:border-border'}`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className={`inline-flex items-center gap-2 min-h-6 rounded-full px-2.5 text-[11px] font-bold before:content-[''] before:size-1.5 before:rounded-full before:bg-current ${PRIORITY_CLS[claim.testPriority]}`}>{prio.label}</span>
                  <span className="flex items-center gap-2 text-text-tertiary text-[11px]">
                    {completedClaimIds.includes(claim.id) && <span className="inline-flex items-center gap-1 font-semibold text-success"><Check size={12} />已完成</span>}
                    {preparedClaimIds.includes(claim.id) && <span className="font-semibold text-success">已准备</span>}
                    <span className="font-mono">{String(originalIndex + 1).padStart(2, '0')}</span>
                  </span>
                </div>
                <div className="text-[14px] leading-[1.55] font-[650] text-text-primary mb-2">{claim.content}</div>
                <div className="text-text-tertiary text-[12px] leading-[1.5]">{CLAIM_CATEGORY_LABELS[claim.category]} · {claim.capability}</div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
