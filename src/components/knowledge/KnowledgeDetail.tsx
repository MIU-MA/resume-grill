'use client'

import { Check, MoreHorizontal, Pencil, RefreshCw, Trash2, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ResumeClaim } from '@/domain/resume-schema'
import type { KnowledgeItem } from '@/lib/knowledge'
import { Button } from '@/components/ui/Button'
import { useDropdown } from '@/hooks/use-dropdown'
import { KNOWLEDGE_SOURCE_META } from '@/components/knowledge/knowledge-meta'

type DetailPanelProps = {
  item: KnowledgeItem
  claim: ResumeClaim | null
  editing: boolean
  draft: { title: string; note: string }
  onDraftChange: (d: { title: string; note: string }) => void
  onStartEdit: () => void
  onSubmitEdit: () => void
  onCancelEdit: () => void
  onToggle: () => void
  onDelete: () => void
  onRetest: (claim: ResumeClaim) => void
}

export function KnowledgeDetail({
  item,
  claim,
  editing,
  draft,
  onDraftChange,
  onStartEdit,
  onSubmitEdit,
  onCancelEdit,
  onToggle,
  onDelete,
  onRetest,
}: DetailPanelProps) {
  const meta = KNOWLEDGE_SOURCE_META[item.source]
  const mastered = item.status === 'mastered'
  const { open, toggle, close, ref } = useDropdown()

  if (editing) {
    return (
      <div className="space-y-3 p-5">
        <div className="text-[13px] font-bold">编辑知识点</div>
        <input
          autoFocus
          value={draft.title}
          onChange={(e) => onDraftChange({ ...draft, title: e.target.value })}
          className="w-full rounded-lg border border-brand bg-white px-3 py-2 text-[13px] font-medium text-text-primary focus:outline-none"
        />
        <textarea
          value={draft.note}
          onChange={(e) => onDraftChange({ ...draft, note: e.target.value })}
          rows={4}
          placeholder="备注（可选）…"
          className="w-full resize-y rounded-lg border border-line-strong bg-white px-3 py-2 text-[12px] text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
        />
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onCancelEdit}><X size={14} />取消</Button>
          <Button variant="primary" onClick={onSubmitEdit}>保存</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>{meta.label}</span>
            {claim && (
              <span className="rounded bg-surface-hover px-2 py-0.5 text-[10px] font-semibold text-text-tertiary">{claim.title}</span>
            )}
            {mastered && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success"><Check size={12} />已学会</span>
            )}
          </div>
          <h3 className="mt-2.5 m-0 text-[15px] font-bold leading-snug text-text-primary">{item.title}</h3>
        </div>
        <div ref={ref} className="relative flex-none">
          <button
            type="button"
            onClick={toggle}
            className="grid size-8 place-items-center rounded-lg bg-transparent text-text-tertiary hover:bg-surface-hover hover:text-text-primary"
            aria-label="更多操作"
          >
            <MoreHorizontal size={16} />
          </button>
          {open && (
            <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-line bg-white py-1 shadow-[0_4px_16px_rgba(16,24,40,0.08)]">
              <MenuItem onClick={() => { onStartEdit(); close() }}><Pencil size={13} />编辑</MenuItem>
              {claim && (
                <MenuItem onClick={() => { onRetest(claim); close() }}><RefreshCw size={13} />再练一次</MenuItem>
              )}
              <MenuItem danger onClick={() => { onDelete(); close() }}><Trash2 size={13} />删除</MenuItem>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-1.5 overflow-y-auto">
        {(item.detail || item.note) ? (
          <p className="text-[13px] leading-relaxed text-text-secondary whitespace-pre-wrap">
            {item.detail || item.note}
          </p>
        ) : (
          <p className="text-[12px] text-text-tertiary">暂无正文内容。</p>
        )}
      </div>

      <div className="mt-4 border-t border-line pt-3.5">
        <Button variant={mastered ? 'secondary' : 'primary'} className="w-full" onClick={onToggle}>
          <Check size={15} />{mastered ? '标为待复习' : '标为已学会'}
        </Button>
        {!claim && (
          <p className="mt-2 text-center text-[11px] text-text-tertiary">手动添加的内容不关联简历要点。</p>
        )}
      </div>
    </div>
  )
}

function MenuItem({ onClick, danger, children }: { onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-[13px] transition-colors hover:bg-surface-hover ${danger ? 'text-danger' : 'text-text-primary'}`}
    >
      {children}
    </button>
  )
}
