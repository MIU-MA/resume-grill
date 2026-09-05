import { CLAIM_FILTERS, type ClaimFilter } from '@/features/audit/claim-list-types'

type ClaimListToolbarProps = {
  filter: ClaimFilter
  multi: boolean
  onFilterChange: (filter: ClaimFilter) => void
  onToggleMulti: () => void
}

export function ClaimListToolbar({
  filter,
  multi,
  onFilterChange,
  onToggleMulti,
}: ClaimListToolbarProps) {
  return (
    <div className="flex-none border-b border-line px-3.5 pb-2 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <strong className="text-[15px]">简历要点</strong>
        <button
          type="button"
          onClick={onToggleMulti}
          className="text-[11px] text-text-tertiary hover:text-text-primary"
        >
          {multi ? '退出多选' : '多选'}
        </button>
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {CLAIM_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onFilterChange(value)}
            className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold ${
              filter === value
                ? 'bg-brand-soft text-brand'
                : 'text-text-tertiary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
