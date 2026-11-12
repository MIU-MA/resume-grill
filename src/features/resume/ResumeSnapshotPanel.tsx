'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { ResumeSnapshotSummary } from '@/domain/resume-snapshot'
import { importResumeTextCopy, type ResumeDocument } from './lib/resume-library'
import { listResumeSnapshots, readResumeSnapshot, saveResumeSnapshot } from './lib/resume-snapshot-client'

export function ResumeSnapshotPanel({ documents, onOpen }: { documents: ResumeDocument[]; onOpen: (document: ResumeDocument) => void }) {
  const [snapshots, setSnapshots] = useState<ResumeSnapshotSummary[]>([])
  const [selected, setSelected] = useState(documents[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const lock = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try { await action() }
    catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : '操作失败，请重试。') }
    finally { lock.current = false; if (mounted.current) setBusy(false) }
  }
  useEffect(() => { void run(async () => { const items = await listResumeSnapshots(); if (mounted.current) setSnapshots(items) }) }, [])
  const current = documents.find(document => document.id === selected)
  return <section aria-label="本机文本备份" className="border-t border-line py-4">
    <p className="mt-0 text-label text-text-secondary">保存在本机 Go 服务。仅备份正文，不含 PDF、照片、检查结果或面试记录；导入时另存文本副本。</p>
    <div className="flex flex-wrap items-end gap-2">
      <label className="mail-label min-w-0 flex-1">选择简历<select className="mail-input" value={current?.id ?? ''} disabled={busy} onChange={event => setSelected(event.target.value)}><option value="">请选择</option>{documents.map(document => <option key={document.id} value={document.id}>{document.sourceFile}</option>)}</select></label>
      <Button disabled={busy || !current} onClick={() => void run(async () => {
        const saved = await saveResumeSnapshot(current!.id)
        if (mounted.current) { setSnapshots(items => [saved, ...items].slice(0, 100)); setNotice('文本快照已保存。') }
      })}>保存文本快照</Button>
      <Button variant="secondary" disabled={busy} onClick={() => void run(async () => { const items = await listResumeSnapshots(); if (mounted.current) setSnapshots(items) })}>刷新备份</Button>
    </div>
    {busy && <p role="status" className="text-label">正在处理…</p>}
    {error && <p role="alert" className="text-label text-danger">{error}</p>}
    {notice && <p role="status" className="text-label">{notice}</p>}
    <ul className="my-3 max-h-64 list-none divide-y divide-line overflow-y-auto p-0">{snapshots.map(snapshot => <li key={snapshot.id} className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1"><strong className="block truncate text-label">{snapshot.sourceName}</strong><span className="text-meta text-text-tertiary">{new Date(snapshot.createdAt).toLocaleString('zh-CN')}</span></div>
      <Button variant="ghost" disabled={busy} onClick={() => void run(async () => {
        const saved = await readResumeSnapshot(snapshot.id)
        if (!mounted.current) return
        const copy = await importResumeTextCopy(saved.sourceName, saved.rawText)
        if (mounted.current) onOpen(copy)
      })}>导入文本副本</Button>
    </li>)}</ul>
    {!busy && !error && snapshots.length === 0 && <p className="text-label text-text-tertiary">还没有文本备份。</p>}
  </section>
}
