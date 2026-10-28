'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { tailoredResumeText, tailoringChangeKey, tailoringMail } from '@/domain/resume-tailoring'
import { PdfPages } from '@/features/resume/PdfPages'
import type { ResumePdfArtifact } from '@/features/resume/lib/resume-pdf'
import { generateJobResume, previewJobResume, saveJobResume, type TailoringSession } from './job-resume-tailoring'
import type { AttachmentSource } from './mail-draft-storage'
import type { Draft, SavedJobPreparation } from './draft-state'

type Props = {
  draft: Draft; file: File; source?: AttachmentSource; person: string
  onClose: () => void
  onApply: (change: Partial<Draft>, saved: SavedJobPreparation) => Promise<void>
}
export function JobResumeDialog({ draft, file, source, person, onClose, onApply }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const controller = useRef<AbortController | null>(null)
  const savedRevision = useRef<{ artifact: ResumePdfArtifact; company: string; role: string; document: Awaited<ReturnType<typeof saveJobResume>> } | null>(null)
  const [session, setSession] = useState<TailoringSession | null>(null)
  const [accepted, setAccepted] = useState<Set<string>>(new Set())
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [originalOrder, setOriginalOrder] = useState(false)
  const [company, setCompany] = useState(draft.company)
  const [role, setRole] = useState(draft.role)
  const [mailEdit, setMailEdit] = useState<{ subject?: string; body?: string }>({})
  const [artifact, setArtifact] = useState<ResumePdfArtifact | null>(null)
  const [view, setView] = useState<'compare' | 'pdf'>('compare')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => { ref.current?.showModal() }, [])
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort
    setBusy(true); setError(''); setSession(null)
    void generateJobResume(draft, file, source, abort.signal).then(value => {
      if (abort.signal.aborted) return
      setSession(value); setAccepted(new Set(value.plan.changes.map(tailoringChangeKey)))
      setCompany(draft.company || value.plan.company); setRole(draft.role || value.plan.role)
    }).catch(cause => { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : '生成失败。') })
      .finally(() => { if (!abort.signal.aborted) setBusy(false) })
    return () => abort.abort()
    // Inputs are a frozen snapshot taken on the explicit generate click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry])
  const text = useMemo(() => session ? tailoredResumeText(session.sections, session.plan, accepted, edits, originalOrder) : '', [session, accepted, edits, originalOrder])
  const generatedMail = session ? tailoringMail(session.sections, session.plan, accepted, edits, person, company, role) : { subject: '', body: '' }
  const mail = { subject: mailEdit.subject ?? generatedMail.subject, body: mailEdit.body ?? generatedMail.body }
  const invalidate = () => { setArtifact(null); setView('compare'); setError('') }
  const perform = async (apply: boolean) => {
    if (!session || busy) return
    setBusy(true); setError('')
    try {
      if (!text.trim() || text.length > 20000) throw new Error('简历正文须为 1–20000 字。')
      if (!mail.subject.trim() || mail.subject.length > 200 || /[\r\n]/.test(mail.subject) || !mail.body.trim() || mail.body.length > 12000) throw new Error('请检查邮件主题和正文。')
      const pdf = artifact ?? await previewJobResume(session, text, company, role)
      setArtifact(pdf)
      if (!apply) { setView('pdf'); return }
      const cached = savedRevision.current
      const document = cached?.artifact === pdf && cached.company === company && cached.role === role
        ? cached.document : await saveJobResume(session, text, pdf, { company, role })
      savedRevision.current = { artifact: pdf, company, role, document }
      await onApply({ company, role, subject: mail.subject, body: mail.body, automatic: false }, {
        jobDescription: (draft.jobDescription ?? '').trim(), attachment: document.originalFile,
        attachmentSource: { id: document.id, updatedAt: document.originalFileUpdatedAt ?? document.updatedAt }, attachmentUse: 'preparation',
        tailoredResume: { jobDescription: (draft.jobDescription ?? '').trim(), company, role, sourceFile: file, source, documentId: document.id, text: pdf.text },
      })
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败。') }
    finally { setBusy(false) }
  }
  return <dialog ref={ref} aria-label="按岗位修改简历" onCancel={event => { event.preventDefault(); if (!busy || !session) { controller.current?.abort(); onClose() } }} className="mail-dialog resume-workbench w-[1120px] max-w-[calc(100vw-24px)] border border-line-strong bg-surface p-0 text-text-primary backdrop:bg-black/30">
    <header className="flex items-center gap-3 border-b border-line px-5 py-4"><div className="min-w-0 flex-1"><h2 className="m-0 text-[16px] font-semibold">按岗位修改简历</h2><p className="mb-0 mt-1 truncate text-[12px] text-text-tertiary">{file.name} · {draft.recipient || '当前岗位'}</p></div><Button variant="ghost" disabled={busy && !!session} onClick={() => { controller.current?.abort(); onClose() }}>关闭</Button></header>
    <div className="max-h-[65dvh] overflow-y-auto p-5">
      {!session && <p role="status" className="text-[13px] text-text-secondary">{busy ? '正在根据 JD 整理修改建议…' : '生成未完成。'}{!busy && <Button variant="secondary" onClick={() => setRetry(value => value + 1)}>重试</Button>}</p>}
      {session && <>
        <div className="mb-4 grid gap-3 sm:grid-cols-2"><label className="mail-label">公司（选填）<input className="mail-input" maxLength={120} value={company} disabled={busy} onChange={event => { setCompany(event.target.value); invalidate() }} /></label><label className="mail-label">岗位（选填）<input className="mail-input" maxLength={120} value={role} disabled={busy} onChange={event => { setRole(event.target.value); invalidate() }} /></label></div>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[12px]"><span className="mr-auto text-text-secondary">{session.plan.changes.length} 处建议 · 已采用 {accepted.size} 处</span><Button variant="secondary" disabled={busy} onClick={() => { if (view === 'pdf') setView('compare'); else void perform(false) }}>{view === 'pdf' ? '返回修改对照' : '预览实际 PDF'}</Button><label className="flex items-center gap-1"><input type="checkbox" checked={originalOrder} disabled={busy} onChange={event => { setOriginalOrder(event.target.checked); invalidate() }} />保留原章节顺序</label></div>
        {view === 'pdf' && artifact ? <PdfPages file={artifact.file} /> : <div className="divide-y divide-line border-y border-line">
          {session.plan.changes.map(change => { const key = tailoringChangeKey(change); const section = session.sections.find(item => item.id === change.sectionId)!; return <article key={key} className="py-4"><div className="mb-3 flex gap-3 text-[12px]"><strong className="mr-auto font-medium">{section.title}</strong><label className="flex items-center gap-1"><input type="checkbox" checked={accepted.has(key)} disabled={busy} onChange={() => { setAccepted(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next }); invalidate() }} />采用这处修改</label></div><div className="grid gap-4 sm:grid-cols-2"><div><p className="mt-0 text-[11px] text-text-tertiary">原文</p><p className="m-0 whitespace-pre-wrap text-[13px] leading-[1.8]">{section.lines[change.lineIndex]}</p></div><label className="mail-label">修改稿<textarea className="mail-input mt-2 min-h-[110px] resize-y leading-[1.8]" value={edits[key] ?? change.after} maxLength={3000} disabled={busy || !accepted.has(key)} onChange={event => { setEdits(current => ({ ...current, [key]: event.target.value })); invalidate() }} /></label></div><p className="mb-0 mt-3 text-[12px] leading-relaxed text-text-secondary">岗位要求：{change.requirement}<br />{change.reason}</p></article> })}
          {!session.plan.changes.length && <p className="text-[13px] text-text-secondary">没有需要改写的段落，可以查看完整简历和岗位缺项。</p>}
          <details className="py-3 text-[12px]"><summary className="cursor-pointer text-text-secondary">查看完整投递稿与章节顺序</summary><p className="whitespace-pre-wrap leading-[1.8]">{text}</p></details>
        </div>}
        {session.plan.gaps.length > 0 && <details className="my-4 text-[12px]"><summary className="cursor-pointer text-warning">原简历未体现的要求 · {session.plan.gaps.length} 项</summary>{session.plan.gaps.map(gap => <p key={gap} className="leading-relaxed text-text-secondary">{gap}</p>)}</details>}
        <section className="mt-5 border-t border-line pt-4" aria-label="随附邮件"><label className="mail-label">邮件主题<input className="mail-input" maxLength={200} value={mail.subject} disabled={busy} onChange={event => setMailEdit(current => ({ ...current, subject: event.target.value }))} /></label><label className="mail-label mt-3">正文<textarea className="mail-input min-h-[180px] resize-y leading-[1.8]" maxLength={12000} value={mail.body} disabled={busy} onChange={event => setMailEdit(current => ({ ...current, body: event.target.value }))} /></label>{mailEdit.body !== undefined && <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-text-tertiary"><span>正文已手动修改，调整简历时会保留。</span><button type="button" className="text-accent underline" disabled={busy} onClick={() => setMailEdit(current => ({ ...current, body: undefined }))}>按当前简历更新正文</button></div>}</section>
      </>}
      {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
    </div>
    <footer className="flex flex-wrap items-center gap-3 border-t border-line bg-surface-soft px-5 py-4"><p className="m-0 mr-auto text-[12px] text-text-tertiary">确认后另存为 PDF，只用于当前岗位；原文件保留。</p><Button disabled={!session || busy} loading={busy && !!session} onClick={() => void perform(true)}>保存并用于这封邮件</Button></footer>
  </dialog>
}
