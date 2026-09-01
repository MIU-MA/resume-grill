'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, CircleHelp, Lightbulb, Plus, X } from 'lucide-react'
import type { ResumeAnalysis, ResumeClaim } from '@/domain/resume-schema'
import { Button } from '@/components/ui/Button'
import type { KnowledgeItem, KnowledgeItemInput, KnowledgeItemPatch } from '@/lib/knowledge'

import {
  type KnowledgeSort,
  type KnowledgeSourceFilter,
  type KnowledgeStatusFilter,
} from '@/components/knowledge/knowledge-meta'
import { KnowledgeDetail } from '@/components/knowledge/KnowledgeDetail'
import { KnowledgeToolbar } from '@/components/knowledge/KnowledgeToolbar'
import { KnowledgeList } from '@/components/knowledge/KnowledgeList'
import { KnowledgeEditor } from '@/components/knowledge/KnowledgeEditor'

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
  const [statusFilter, setStatusFilter] = useState<KnowledgeStatusFilter>('open')
  const [sourceFilter, setSourceFilter] = useState<KnowledgeSourceFilter>('all')
  const [sortBy, setSortBy] = useState<KnowledgeSort>('updated')
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
      <div className="flex items-start justify-between gap-4 rounded-lg bg-white p-5 shadow-card">
        <div>
          <h2 className="m-0 text-[18px] font-bold tracking-[-0.025em]">复习笔记</h2>
          <p className="mt-1.5 text-[13px] text-text-tertiary leading-relaxed">
            模拟面试时记下的「没听懂」会自动放到这里，也可以手动添加。
          </p>
          <div className="mt-3 flex items-center gap-2 text-[12px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 font-semibold text-warning">
              <CircleHelp size={12} />待复习 {openCount}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 font-semibold text-success">
              <Check size={12} />已学会 {masteredCount}
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

      <KnowledgeToolbar
        status={statusFilter}
        source={sourceFilter}
        sort={sortBy}
        onStatusChange={setStatusFilter}
        onSourceChange={setSourceFilter}
        onSortChange={setSortBy}
      />

      {/* 添加表单 */}
      {adding && (
        <KnowledgeEditor
          title={draft.title}
          note={draft.note}
          onChange={setDraft}
          onSubmit={submitAdd}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* 主从布局：左侧列表 + 右侧详情 */}
      <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-4 items-start max-[900px]:grid-cols-1">
        <KnowledgeList
          items={visible}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id)
            setEditing(false)
          }}
        />

        {/* 右侧详情面板 */}
        <div className="overflow-hidden rounded-lg border border-line bg-white shadow-card">
          {!selected ? (
            <div className="px-5 py-16 text-center">
              <Lightbulb size={22} className="mx-auto mb-3 text-text-tertiary" />
              <p className="m-0 text-[13px] font-semibold">选择一条查看详情</p>
            </div>
          ) : (
            <KnowledgeDetail
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
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-line bg-white px-4 py-2.5 shadow-[0_8px_24px_rgba(16,24,40,0.12)]">
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
