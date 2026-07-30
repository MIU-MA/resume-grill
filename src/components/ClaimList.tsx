import { useState } from 'react'
import { CLAIM_CATEGORY_LABELS, type ResumeAnalysis, type RiskLevel } from '@/domain/resume-schema'
import { RISK_META } from '@/lib/risk'

const RISK_OPTIONS: { label: string; value: RiskLevel | 'all' }[] = [
  { label: '全部风险', value: 'all' },
  { label: '高风险', value: 'high' },
  { label: '中风险', value: 'medium' },
  { label: '证据较全', value: 'low' },
]

const RISK_CLS: Record<string, string> = {
  high: 'text-danger bg-danger-soft [&::before]:bg-danger',
  medium: 'text-warning bg-warning-soft [&::before]:bg-warning',
  low: 'text-success bg-success-soft [&::before]:bg-success',
}

type ClaimListProps = {
  analysis: ResumeAnalysis
  selectedIndex: number
  preparedClaimIds: string[]
  onSelect: (index: number) => void
}

export function ClaimList({ analysis, selectedIndex, preparedClaimIds, onSelect }: ClaimListProps) {
  const [filter, setFilter] = useState<RiskLevel | 'all'>('all')

  const visible = analysis.claims
    .map((claim, originalIndex) => ({ claim, originalIndex }))
    .filter(({ claim }) => filter === 'all' || claim.interviewRisk === filter)

  return (
    <div className="flex flex-col max-h-[650px]">
      <div className="flex items-center justify-between px-5 py-[18px] border-b border-border flex-none">
        <div>
          <div className="text-[15px] font-bold">简历声明</div>
          <div className="text-text-tertiary text-[12px] mt-1">
            {filter === 'all' ? `共 ${visible.length} 条` : `${RISK_META[filter as RiskLevel].label} · ${visible.length} 条`}
          </div>
        </div>
        <select
          className="h-[34px] text-[12px] border border-border rounded-lg bg-white text-text-secondary px-2.5 cursor-pointer"
          value={filter}
          onChange={(e) => setFilter(e.target.value as RiskLevel | 'all')}
        >
          {RISK_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 scroll-smooth">
        {visible.length === 0 ? (
          <div className="text-center text-text-tertiary text-[13px] py-12">没有匹配的声明</div>
        ) : (
          visible.map(({ claim, originalIndex }) => {
            const risk = RISK_META[claim.interviewRisk]
            const isActive = originalIndex === selectedIndex
            return (
              <button
                key={claim.id}
                type="button"
                onClick={() => onSelect(originalIndex)}
                className={`w-full text-left rounded-[10px] px-3 py-3 transition-colors block border ${isActive ? 'border-brand/30 bg-brand-soft shadow-[inset_3px_0_0_#2563eb]' : 'border-transparent bg-transparent hover:bg-surface-soft hover:border-border'}`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className={`inline-flex items-center gap-2 min-h-6 rounded-full px-2.5 text-[11px] font-bold before:content-[''] before:size-1.5 before:rounded-full before:bg-current ${RISK_CLS[claim.interviewRisk]}`}>{risk.label}</span>
                  <span className="flex items-center gap-2 text-text-tertiary text-[11px]">
                    {preparedClaimIds.includes(claim.id) && <span className="font-semibold text-success">已准备</span>}
                    <span className="font-mono">{String(originalIndex + 1).padStart(2, '0')}</span>
                  </span>
                </div>
                <div className="text-[14px] leading-[1.55] font-[650] text-text-primary mb-2">{claim.content}</div>
                <div className="text-text-tertiary text-[12px] leading-[1.5]">{CLAIM_CATEGORY_LABELS[claim.category]} · {claim.evidenceGap[0] || '证据较为充分'}</div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
