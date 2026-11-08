'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, CircleHelp, Lightbulb, Plus } from 'lucide-react'
import type { ResumeAnalysis, ResumeClaim } from '@/domain/resume-schema'
import { useUndoQueue } from '@/hooks/use-undo-queue'
import { UndoNotice } from '@/components/ui/UndoNotice'
import { Button } from '@/components/ui/Button'
import type { KnowledgeItem, KnowledgeItemInput, KnowledgeItemPatch } from '@/domain/knowledge'

import {
  type KnowledgeSort,
  type KnowledgeSourceFilter,
  type KnowledgeStatusFilter,
} from '@/features/knowledge/knowledge-meta'
import { KnowledgeDetail } from '@/features/knowledge/KnowledgeDetail'
import { KnowledgeToolbar } from '@/features/knowledge/KnowledgeToolbar'
import { KnowledgeList } from '@/features/knowledge/KnowledgeList'
import { KnowledgeEditor } from '@/features/knowledge/KnowledgeEditor'
import { KnowledgeStudy } from './KnowledgeStudy'
import { ExternalInterviewReview } from '@/features/interview/ExternalInterviewReview'

type KnowledgeViewProps = {
  analysis?: ResumeAnalysis
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
  const [task, setTask] = useState<'notes' | 'study' | 'review'>('notes')
  const undo = useUndoQueue(6000)

  const openCount = knowledgeItems.filter((i) => i.status === 'open').length
  const masteredCount = knowledgeItems.length - openCount

  const claimIndexById = useMemo(() => {
    const map = new Map<string, number>()
    analysis?.claims.forEach((c, i) => map.set(c.id, i))
    return map
  }, [analysis?.claims])

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
    setSelectedId(null)
    undo.add(`已删除「${item.title}」`, () => { onRestore(item); setSelectedId(item.id) })
  }

  return (
    <div className="space-y-3 pb-6">
      <nav className="flex gap-4 border-b border-line bg-white px-5 py-3" aria-label="待复习任务">{([['notes', '复习笔记'], ['study', '闪卡与突击'], ['review', '真实面试复盘']] as const).map(([key, label]) => <button key={key} aria-current={task === key ? 'page' : undefined} onClick={() => setTask(key)}>{label}</button>)}</nav>
      {task === 'study' && <KnowledgeStudy items={knowledgeItems} onUpdate={onUpdate} />}
      {task === 'review' && <ExternalInterviewReview onAdd={onAdd} />}
      {task === 'notes' && <>
      {/* 顶部概览 */}
      <div className="flex items-start justify-between gap-5 rounded-lg bg-white p-5 shadow-card max-[620px]:flex-col max-[620px]:p-4">
        <div>
          <h2 className="m-0 text-title font-bold tracking-normal">复习笔记</h2>
          <p className="mt-1.5 text-body text-text-tertiary leading-relaxed">
            面试里没懂的问题会记在这里，也可以自己添加笔记。
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-body">
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
        <Button variant="primary" onClick={startAdd} className="max-[620px]:w-full">
          <Plus size={15} />添加笔记
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
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(340px,400px)] items-start gap-3 max-[940px]:grid-cols-1">
        <KnowledgeList
          items={visible}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id)
            setEditing(false)
          }}
        />

        {/* 右侧详情面板 */}
        <div className="overflow-hidden rounded-lg bg-white shadow-card ring-1 ring-black/[0.03] min-[941px]:sticky min-[941px]:top-0 min-[941px]:max-h-[calc(100dvh-120px)] min-[941px]:overflow-y-auto">
          {!selected ? (
            <div className="px-5 py-16 text-center">
              <Lightbulb size={22} className="mx-auto mb-3 text-text-tertiary" />
              <p className="m-0 text-body font-semibold">选择一条查看详情</p>
            </div>
          ) : (
            <KnowledgeDetail
              item={selected}
              claim={selected.claimId ? analysis?.claims.find((c) => c.id === selected.claimId) ?? null : null}
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

      </>}
      <UndoNotice queue={undo} />
    </div>
  )
}
