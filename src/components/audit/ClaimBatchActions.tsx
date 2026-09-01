import type { TestPriority } from '@/domain/resume-schema'

type ClaimBatchActionsProps = {
  selectedIds: string[]
  onMarkPrepared: () => void
  onSetPriority: (priority: TestPriority) => void
  onExit: () => void
}

export function ClaimBatchActions({
  selectedIds,
  onMarkPrepared,
  onSetPriority,
  onExit,
}: ClaimBatchActionsProps) {
  if (selectedIds.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-soft px-3 py-2 text-[11px]">
      <span>已选 {selectedIds.length}</span>
      <button
        type="button"
        onClick={onMarkPrepared}
        className="rounded-md bg-white px-2 py-1 text-text-secondary hover:bg-surface-hover"
      >
        标记已准备
      </button>
      <select
        className="h-6 rounded-md border border-line bg-white px-1 text-text-secondary"
        value=""
        onChange={(event) => onSetPriority(event.target.value as TestPriority)}
        aria-label="批量设置练习顺序"
      >
        <option value="" disabled>设置练习顺序</option>
        <option value="high">重点</option>
        <option value="medium">普通</option>
        <option value="low">有空再练</option>
      </select>
      <button
        type="button"
        onClick={onExit}
        className="ml-auto text-text-tertiary hover:text-text-primary"
      >
        退出多选
      </button>
    </div>
  )
}
