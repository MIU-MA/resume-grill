'use client'

import { useMemo, useState } from 'react'
import { Check, CircleHelp, Lightbulb, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import type { ResumeAnalysis, ResumeClaim } from '@/domain/resume-schema'
import { Button } from '@/components/ui/Button'
import type { KnowledgeItem, KnowledgeItemInput, KnowledgeItemPatch } from '@/lib/knowledge'

type Filter = 'all' | 'blind-spot' | 'knowledge-gap' | 'mastered'

const SOURCE_META: Record<KnowledgeItem['source'], { label: string; cls: string }> = {
  'blind-spot': { label: '漏洞批注', cls: 'text-danger bg-danger-soft' },
  'knowledge-gap': { label: '待补强知识点', cls: 'text-brand bg-brand-soft' },
  manual: { label: '手动添加', cls: 'text-text-tertiary bg-surface-hover' },
}

type KnowledgeViewProps = {
  analysis: ResumeAnalysis
  knowledgeItems: KnowledgeItem[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onUpdate: (id: string, patch: KnowledgeItemPatch) => void
  onAdd: (input: KnowledgeItemInput) => void
  onRetest: (claim: ResumeClaim) => void
}

export function KnowledgeView({
  analysis,
  knowledgeItems,
  onToggle,
  onDelete,
  onUpdate,
  onAdd,
  onRetest,
}: KnowledgeViewProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ title: string; note: string }>({ title: '', note: '' })

  const openCount = knowledgeItems.filter((i) => i.status === 'open').length
  const masteredCount = knowledgeItems.length - openCount

  const claimById = useMemo(() => {
    const map = new Map<string, ResumeClaim>()
    analysis.claims.forEach((c) => map.set(c.id, c))
    return map
  }, [analysis.claims])

  const visible = knowledgeItems.filter((item) => {
    if (filter === 'mastered') return item.status === 'mastered'
    if (filter === 'all') return true
    return item.source === filter
  })

  const startAdd = () => {
    setAdding(true)
    setEditingId(null)
    setDraft({ title: '', note: '' })
  }

  const startEdit = (item: KnowledgeItem) => {
    setEditingId(item.id)
    setAdding(false)
    setDraft({ title: item.title, note: item.note })
  }

  const submitAdd = () => {
    const title = draft.title.trim()
    if (!title) return
    onAdd({ title, note: draft.note })
    setAdding(false)
    setDraft({ title: '', note: '' })
  }

  const submitEdit = (item: KnowledgeItem) => {
    const title = draft.title.trim()
    if (!title) {
      setEditingId(null)
      return
    }
    onUpdate(item.id, { title, note: draft.note })
    setEditingId(null)
  }

  return (
    <div className="space-y-4">
      {/* 顶部卡片 */}
      <div className="flex items-start justify-between gap-4 bg-white border border-border rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-6">
        <div>
          <div className="text-brand text-[12px] font-bold uppercase tracking-[0.08em] mb-2">漏洞与知识点</div>
          <h2 className="m-0 text-[21px] font-bold tracking-[-0.025em]">把追问暴露的漏洞和待补强的知识点收进来</h2>
          <p className="mt-2 text-text-tertiary text-[13px] leading-relaxed">
            能力测试中的「没听懂」批注与总结出的待补强知识点会自动收录，也可手动添加、编辑、标记或删除。
          </p>
          <div className="mt-4 flex items-center gap-2 text-[12px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 font-semibold text-warning">
              <CircleHelp size={12} />待补强 {openCount}
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

      {/* 过滤条 */}
      <div className="flex items-center gap-1 border-b border-border pb-0">
        {([
          ['all', '全部'],
          ['blind-spot', '漏洞批注'],
          ['knowledge-gap', '知识点'],
          ['mastered', '已掌握'],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              filter === key
                ? 'border-brand text-brand'
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 添加表单 */}
      {adding && (
        <div className="bg-white border border-border rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-5 space-y-3">
          <div className="text-[13px] font-bold">添加知识点</div>
          <input
            autoFocus
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="要补强的知识点或漏洞…"
            className="w-full rounded-lg border border-border-strong bg-white px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
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
            className="w-full resize-y rounded-lg border border-border-strong bg-white px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
          />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdding(false)}><X size={14} />取消</Button>
            <Button variant="primary" disabled={!draft.title.trim()} onClick={submitAdd}>保存</Button>
          </div>
        </div>
      )}

      {/* 列表 */}
      <div className="bg-white border border-border rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] overflow-hidden">
        {visible.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Lightbulb size={24} className="mx-auto mb-3 text-text-tertiary" />
            <p className="m-0 text-[14px] font-semibold">还没有收录任何漏洞或知识点</p>
            <p className="mt-2 text-[12px] text-text-tertiary">
              完成一次能力测试后，追问中标记的「没听懂」与总结的待补强知识点会自动出现在这里。
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visible.map((item) => {
              const meta = SOURCE_META[item.source]
              const claim = item.claimId ? claimById.get(item.claimId) : undefined
              const editing = editingId === item.id
              const mastered = item.status === 'mastered'
              return (
                <div key={item.id} className={`flex items-start gap-4 px-5 py-4 ${mastered ? 'bg-success-soft/25' : ''}`}>
                  <div className="min-w-0 flex-1">
                    {editing ? (
                      <input
                        autoFocus
                        value={draft.title}
                        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                        className="w-full rounded-lg border border-brand bg-white px-3 py-1.5 text-[13px] font-medium text-text-primary focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) submitEdit(item)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                      />
                    ) : (
                      <strong className="text-[13px] text-text-primary">{item.title}</strong>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>
                      {claim && (
                        <span className="rounded bg-surface-hover px-2 py-0.5 text-[10px] font-semibold text-text-tertiary">
                          {claim.title}
                        </span>
                      )}
                      {mastered && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
                          <Check size={12} />已掌握
                        </span>
                      )}
                    </div>
                    {(item.detail || item.note) && !editing && (
                      <p className="mt-2 text-[12px] leading-relaxed text-text-secondary">
                        {item.detail}
                        {item.note && item.detail ? '　' : ''}
                        {item.note}
                      </p>
                    )}
                    {editing && (
                      <textarea
                        value={draft.note}
                        onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                        rows={2}
                        placeholder="备注（可选）…"
                        className="mt-2 w-full resize-y rounded-lg border border-border-strong bg-white px-3 py-1.5 text-[12px] text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
                      />
                    )}
                  </div>
                  <div className="flex flex-none items-center gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => onToggle(item.id)}
                      className={`grid size-8 place-items-center rounded-lg transition-colors ${
                        mastered
                          ? 'bg-success-soft text-success hover:brightness-95'
                          : 'bg-transparent text-text-tertiary hover:bg-success-soft hover:text-success'
                      }`}
                      title={mastered ? '重新标为待补强' : '标记已掌握'}
                      aria-label={mastered ? '重新标为待补强' : '标记已掌握'}
                    >
                      <Check size={15} />
                    </button>
                    {claim && (
                      <button
                        type="button"
                        onClick={() => onRetest(claim)}
                        className="grid size-8 place-items-center rounded-lg bg-transparent text-text-tertiary hover:bg-brand-soft hover:text-brand"
                        title="重新测试该声明"
                        aria-label="重新测试该声明"
                      >
                        <RefreshCw size={15} />
                      </button>
                    )}
                    {editing ? (
                      <>
                        <button
                          type="button"
                          onClick={() => submitEdit(item)}
                          className="grid size-8 place-items-center rounded-lg bg-transparent text-text-tertiary hover:bg-surface-hover hover:text-text-primary"
                          title="保存"
                          aria-label="保存编辑"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="grid size-8 place-items-center rounded-lg bg-transparent text-text-tertiary hover:bg-surface-hover hover:text-text-primary"
                          title="取消"
                          aria-label="取消编辑"
                        >
                          <X size={15} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="grid size-8 place-items-center rounded-lg bg-transparent text-text-tertiary hover:bg-surface-hover hover:text-text-primary"
                        title="编辑"
                        aria-label="编辑"
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDelete(item.id)}
                      className="grid size-8 place-items-center rounded-lg bg-transparent text-text-tertiary hover:bg-danger-soft hover:text-danger"
                      title="删除"
                      aria-label="删除"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
