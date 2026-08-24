'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, CircleHelp, Lightbulb, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import type { ResumeAnalysis, ResumeClaim } from '@/domain/resume-schema'
import { Button } from '@/components/ui/Button'
import { useDropdown } from '@/hooks/use-dropdown'
import type { KnowledgeItem, KnowledgeItemInput, KnowledgeItemPatch } from '@/lib/knowledge'

type StatusFilter = 'all' | 'open' | 'mastered'
type SourceFilter = KnowledgeItem['source'] | 'all'
type SortBy = 'updated' | 'claim'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'open', label: '未掌握' },
  { value: 'mastered', label: '已掌握' },
]

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: 'all', label: '全部来源' },
  { value: 'blind-spot', label: '没听懂' },
  { value: 'knowledge-gap', label: '报告总结' },
  { value: 'manual', label: '手动添加' },
]

const SOURCE_META: Record<KnowledgeItem['source'], { label: string; cls: string }> = {
  'blind-spot': { label: '没听懂', cls: 'text-danger bg-danger-soft' },
  'knowledge-gap': { label: '知识盲区', cls: 'text-brand bg-brand-soft' },
  manual: { label: '手动添加', cls: 'text-text-tertiary bg-surface-hover' },
}

type KnowledgeViewProps = {
  analysis: ResumeAnalysis
  knowledgeItems: KnowledgeItem[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onRestore: (item: KnowledgeItem) => void
  onUpdate: (id: string, patch: KnowledgeItemPatch) => void
  onAdd: (input: KnowledgeItemInput) => void
  onRetest: (claim: ResumeClaim) => void
}

export function KnowledgeView({
  analysis,
  knowledgeItems,
  onToggle,
  onDelete,
  onRestore,
  onUpdate,
  onAdd,
  onRetest,
}: KnowledgeViewProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [sortBy, setSortBy] = useState<SortBy>('updated')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ title: '', note: '' })
  const [pendingDelete, setPendingDelete] = useState<KnowledgeItem | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openCount = knowledgeItems.filter((i) => i.status === 'open').length
  const masteredCount = knowledgeItems.length - openCount

  const claimIndexById = useMemo(() => {
    const map = new Map<string, number>()
    analysis.claims.forEach((c, i) => map.set(c.id, i))
    return map
  }, [analysis.claims])

  const visible = useMemo(() => {
    const filtered = knowledgeItems.filter(
      (item) =>
        (statusFilter === 'all' || item.status === statusFilter) &&
        (sourceFilter === 'all' || item.source === sourceFilter),
    )
    return filtered.slice().sort((a, b) => {
      if (sortBy === 'claim') {
        const ai = a.claimId ? (claimIndexById.get(a.claimId) ?? Infinity) : Infinity
        const bi = b.claimId ? (claimIndexById.get(b.claimId) ?? Infinity) : Infinity
        return ai - bi || b.updatedAt - a.updatedAt
      }
      return b.updatedAt - a.updatedAt
    })
  }, [knowledgeItems, statusFilter, sourceFilter, sortBy, claimIndexById])

  const selected = useMemo(
    () => knowledgeItems.find((i) => i.id === selectedId) ?? null,
    [knowledgeItems, selectedId],
  )
  useEffect(() => {
    if (visible.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !selected) setSelectedId(visible[0].id)
  }, [visible, selectedId, selected])

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current)
    }
  }, [])

  const startAdd = () => {
    setAdding(true)
    setEditing(false)
    setDraft({ title: '', note: '' })
  }

  const submitAdd = () => {
    const title = draft.title.trim()
    if (!title) return
    onAdd({ title, note: draft.note })
    setAdding(false)
    setDraft({ title: '', note: '' })
  }

  const startEdit = (item: KnowledgeItem) => {
    setEditing(true)
    setDraft({ title: item.title, note: item.note })
  }

  const submitEdit = (item: KnowledgeItem) => {
    const title = draft.title.trim()
    if (title) onUpdate(item.id, { title, note: draft.note })
    setEditing(false)
  }

  const handleDelete = (item: KnowledgeItem) => {
    onDelete(item.id)
    setPendingDelete(item)
    setSelectedId(null)
    if (undoTimer.current) clearTimeout(undoTimer.current)
    undoTimer.current = setTimeout(() => setPendingDelete(null), 6000)
  }

  const undoDelete = () => {
    if (!pendingDelete) return
    onRestore(pendingDelete)
    setPendingDelete(null)
    setSelectedId(pendingDelete.id)
  }

  return (
    <div className="space-y-4 pb-8">
      {/* 顶部概览 */}
      <div className="flex items-start justify-between gap-4 bg-white border border-line rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-5">
        <div>
          <h2 className="m-0 text-[18px] font-bold tracking-[-0.025em]">漏洞与知识点</h2>
          <p className="mt-1.5 text-[13px] text-text-tertiary leading-relaxed">
            能力测试中标记的「没听懂」与总结出的知识盲区会自动收录，也可手动添加。
          </p>
          <div className="mt-3 flex items-center gap-2 text-[12px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 font-semibold text-warning">
              <CircleHelp size={12} />未掌握 {openCount}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 font-semibold text-success">
              <Check size={12} />已掌握 {masteredCount}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-hover px-2.5 py-1 font-semibold text-text-tertiary">
              <Lightbulb size={12} />共 {knowledgeItems.length}
            </span>
          </div>
        </div>
        <Button variant="primary" onClick={startAdd}>
          <Plus size={15} />添加知识点
        </Button>
      </div>

      {/* 筛选工具栏：状态 + 来源 + 排序 */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line pb-2">
        <FilterGroup label="状态">
          {STATUS_FILTERS.map(({ value, label }) => (
            <FilterPill key={value} active={statusFilter === value} onClick={() => setStatusFilter(value)}>{label}</FilterPill>
          ))}
        </FilterGroup>
        <FilterGroup label="来源">
          {SOURCE_FILTERS.map(({ value, label }) => (
            <FilterPill key={value} active={sourceFilter === value} onClick={() => setSourceFilter(value)}>{label}</FilterPill>
          ))}
        </FilterGroup>
        <select
          className="ml-auto h-[28px] text-[12px] border border-line rounded-md bg-white text-text-secondary px-2 cursor-pointer"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          aria-label="排序方式"
        >
          <option value="updated">最近更新</option>
          <option value="claim">按关联声明</option>
        </select>
      </div>

      {/* 添加表单 */}
      {adding && (
        <div className="bg-white border border-line rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-4 space-y-2.5">
          <div className="text-[13px] font-bold">添加知识点</div>
          <input
            autoFocus
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="要补强的知识点或漏洞…"
            className="w-full rounded-lg border border-line-strong bg-white px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) submitAdd()
              if (e.key === 'Escape') setAdding(false)
            }}
          />
          <textarea
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            placeholder="备注（可选）…"
            rows={2}
            className="w-full resize-y rounded-lg border border-line-strong bg-white px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdding(false)}><X size={14} />取消</Button>
            <Button variant="primary" disabled={!draft.title.trim()} onClick={submitAdd}>保存</Button>
          </div>
        </div>
      )}

      {/* 主从布局：左侧列表 + 右侧详情 */}
      <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-4 items-start max-[900px]:grid-cols-1">
        <div className="bg-white border border-line rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="text-[13px] font-bold">条目列表</div>
            <div className="text-[12px] text-text-tertiary">{visible.length} 条</div>
          </div>
          {visible.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Lightbulb size={22} className="mx-auto mb-3 text-text-tertiary" />
              <p className="m-0 text-[13px] font-semibold text-text-primary">没有匹配的条目</p>
              <p className="mt-1.5 text-[12px] text-text-tertiary">调整筛选条件，或完成一次能力测试让它自动收录。</p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {visible.map((item) => {
                const active = item.id === selectedId
                const meta = SOURCE_META[item.source]
                const mastered = item.status === 'mastered'
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setSelectedId(item.id); setEditing(false) }}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${active ? 'bg-brand-soft' : 'hover:bg-surface-soft'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${active ? 'bg-white/60 text-brand' : meta.cls}`}>{meta.label}</span>
                        {mastered && <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-success"><Check size={10} />已掌握</span>}
                      </div>
                      <p className="mt-1 truncate text-[13px] font-medium text-text-primary">{item.title}</p>
                    </div>
                    <span className="flex-none text-[11px] text-text-tertiary">{formatUpdatedAt(item.updatedAt)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 右侧详情面板 */}
        <div className="rounded-xl border border-line bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)] overflow-hidden">
          {!selected ? (
            <div className="px-5 py-16 text-center">
              <Lightbulb size={22} className="mx-auto mb-3 text-text-tertiary" />
              <p className="m-0 text-[13px] font-semibold">选择一条查看详情</p>
            </div>
          ) : (
            <DetailPanel
              item={selected}
              claim={selected.claimId ? analysis.claims.find((c) => c.id === selected.claimId) ?? null : null}
              editing={editing}
              draft={draft}
              onDraftChange={setDraft}
              onStartEdit={() => startEdit(selected)}
              onSubmitEdit={() => submitEdit(selected)}
              onCancelEdit={() => setEditing(false)}
              onToggle={() => onToggle(selected.id)}
              onDelete={() => handleDelete(selected)}
              onRetest={(claim) => onRetest(claim)}
            />
          )}
        </div>
      </div>

      {/* 删除撤销条 */}
      {pendingDelete && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-line bg-white px-4 py-2.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
          <span className="max-w-[260px] truncate text-[13px] text-text-secondary">
            已删除「{pendingDelete.title}」
          </span>
          <button type="button" onClick={undoDelete} className="bg-transparent text-[13px] font-semibold text-brand hover:underline">
            撤销
          </button>
          <button type="button" onClick={() => setPendingDelete(null)} className="grid size-6 place-items-center rounded-md bg-transparent text-text-tertiary hover:bg-surface-hover" aria-label="关闭">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

/* ── 右侧详情面板 ─────────────────────────────── */

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

function DetailPanel({
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
  const meta = SOURCE_META[item.source]
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
            <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>
            {claim && (
              <span className="rounded bg-surface-hover px-2 py-0.5 text-[10px] font-semibold text-text-tertiary">{claim.title}</span>
            )}
            {mastered && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success"><Check size={12} />已掌握</span>
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
                <MenuItem onClick={() => { onRetest(claim); close() }}><RefreshCw size={13} />重新测试</MenuItem>
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
          <Check size={15} />{mastered ? '改回未掌握' : '标记已掌握'}
        </Button>
        {!claim && (
          <p className="mt-2 text-center text-[11px] text-text-tertiary">手动添加的条目与任何简历声明无关。</p>
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

/* ── 小组件 ─────────────────────────────────── */

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-semibold text-text-tertiary">{label}</span>
      <div className="flex items-center gap-0.5">{children}</div>
    </div>
  )
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
        active ? 'bg-brand-soft text-brand' : 'bg-transparent text-text-tertiary hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  )
}

function formatUpdatedAt(timestamp: number): string {
  const d = new Date(timestamp)
  const now = Date.now()
  const diff = now - timestamp
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(d)
}