import type { ReactNode } from 'react'
import {
  KNOWLEDGE_SOURCE_FILTERS,
  KNOWLEDGE_STATUS_FILTERS,
  type KnowledgeSort,
  type KnowledgeSourceFilter,
  type KnowledgeStatusFilter,
} from '@/features/knowledge/knowledge-meta'

type KnowledgeToolbarProps = {
  status: KnowledgeStatusFilter
  source: KnowledgeSourceFilter
  sort: KnowledgeSort
  onStatusChange: (value: KnowledgeStatusFilter) => void
  onSourceChange: (value: KnowledgeSourceFilter) => void
  onSortChange: (value: KnowledgeSort) => void
}

export function KnowledgeToolbar({
  status,
  source,
  sort,
  onStatusChange,
  onSourceChange,
  onSortChange,
}: KnowledgeToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg bg-white px-3 py-2.5 shadow-card">
      <FilterGroup label="状态">
        {KNOWLEDGE_STATUS_FILTERS.map(({ value, label }) => (
          <FilterPill
            key={value}
            active={status === value}
            onClick={() => onStatusChange(value)}
          >
            {label}
          </FilterPill>
        ))}
      </FilterGroup>
      <FilterGroup label="来源">
        {KNOWLEDGE_SOURCE_FILTERS.map(({ value, label }) => (
          <FilterPill
            key={value}
            active={source === value}
            onClick={() => onSourceChange(value)}
          >
            {label}
          </FilterPill>
        ))}
      </FilterGroup>
      <select
        className="ml-auto h-7 cursor-pointer rounded-md border border-line bg-white px-2 text-[12px] text-text-secondary max-[620px]:ml-0 max-[620px]:w-full"
        value={sort}
        onChange={(event) => onSortChange(event.target.value as KnowledgeSort)}
        aria-label="排序方式"
      >
        <option value="updated">最近更新</option>
        <option value="claim">按简历要点</option>
      </select>
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-semibold text-text-tertiary">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-0.5">{children}</div>
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
        active
          ? 'bg-brand-soft text-brand'
          : 'bg-transparent text-text-tertiary hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  )
}
