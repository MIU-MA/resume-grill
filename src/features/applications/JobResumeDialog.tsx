'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { tailoredOriginalResumeText, tailoredResumeText, tailoringChangeKey, tailoringMail } from '@/domain/resume-tailoring'
import { JobResumeWorkspace, type JobResumeView } from './JobResumeWorkspace'
import type { ResumePdfArtifact } from '@/features/resume/lib/resume-pdf'
import { generateJobResume, previewJobResume, saveJobResume, type TailoringSession } from './job-resume-tailoring'
import type { AttachmentSource } from './mail-draft-storage'
import type { Draft, SavedJobPreparation } from './draft-state'
import { resumeTemplateId, type ResumeTemplateId } from '@/domain/resume-template'
import { useResumePdf } from '@/features/resume/hooks/use-resume-pdf'

type Props = {
  draft: Draft; file: File; source?: AttachmentSource; person: string; initialTemplate?: ResumeTemplateId
  onClose: () => void
  onApply: (change: Partial<Draft>, saved: SavedJobPreparation) => Promise<void>
}
export function JobResumeDialog({ draft, file, source, person, initialTemplate, onClose, onApply }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const controller = useRef<AbortController | null>(null)
  const savedRevision = useRef<{ artifact: ResumePdfArtifact; company: string; role: string; document: Awaited<ReturnType<typeof saveJobResume>> } | null>(null)
  const [session, setSession] = useState<TailoringSession | null>(null)
  const [accepted, setAccepted] = useState<Set<string>>(new Set())
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [originalOrder, setOriginalOrder] = useState(true)
  const [company, setCompany] = useState(draft.company)
  const [role, setRole] = useState(draft.role)
  const [mailEdit, setMailEdit] = useState<{ subject?: string; body?: string }>({})
  const [artifact, setArtifact] = useState<ResumePdfArtifact | null>(null)
  const isPdf = /\.pdf$/i.test(file.name)
  const [template, setTemplate] = useState<ResumeTemplateId>(resumeTemplateId(initialTemplate ?? (isPdf ? 'original' : undefined)))
  const [view, setView] = useState<JobResumeView>(isPdf ? 'source' : 'compare')
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [suggestionError, setSuggestionError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => { ref.current?.showModal() }, [])
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort
    setGenerating(true); setSuggestionError('')
    void generateJobResume(draft, file, source, abort.signal, value => {
      if (!abort.signal.aborted) setSession(current => current ?? value)
    }).then(value => {
      if (abort.signal.aborted) return
      setSession(value)
      setCompany(current => current || draft.company || value.plan.company); setRole(current => current || draft.role || value.plan.role)
    }).catch(cause => { if (!abort.signal.aborted) setSuggestionError(cause instanceof Error ? cause.message : '建议未能生成。') })
      .finally(() => { if (!abort.signal.aborted) setGenerating(false) })
    return () => abort.abort()
    // Inputs are a frozen snapshot taken on the explicit generate click.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry])
  const text = useMemo(() => session ? template === 'original'
    ? tailoredOriginalResumeText(session.rawText, session.sections, session.plan, accepted, edits)
    : tailoredResumeText(session.sections, session.plan, accepted, edits, originalOrder) : '', [session, accepted, edits, originalOrder, template])
  const sourcePdf = useResumePdf(text, file.name, !!session && template === 'original', template, file, session?.rawText ?? '')
  const generatedMail = session ? tailoringMail(session.sections, session.plan, accepted, edits, person, company, role) : { subject: '', body: '' }
  const mail = { subject: mailEdit.subject ?? generatedMail.subject, body: mailEdit.body ?? generatedMail.body }
  const invalidate = () => { setArtifact(null); setError('') }
  const editLine = (key: string, value: string) => {
    if (busy) return
    const original = session?.sections.flatMap(section => section.lines.map((line, lineIndex) => ({ key: tailoringChangeKey({ sectionId: section.id, lineIndex }), line }))).find(item => item.key === key)?.line
    if (value === original) { resetLine(key); return }
    setEdits(current => ({ ...current, [key]: value }))
    setAccepted(current => { const next = new Set(current); next.add(key); return next })
    invalidate()
  }
  const resetLine = (key: string) => {
    if (busy) return
    setEdits(current => { const next = { ...current }; delete next[key]; return next })
    setAccepted(current => { const next = new Set(current); next.delete(key); return next })
    invalidate()
  }
  const perform = async (apply: boolean, selectedTemplate = template) => {
    if (!session || busy) return
    // Saving confirms the visible draft; a late model response must not change it mid-save.
    if (apply && generating) { controller.current?.abort(); setGenerating(false) }
    setBusy(true); setError('')
    try {
      if (!text.trim() || text.length > 20000) throw new Error('简历正文须为 1–20000 字。')
      if (apply && (!mail.subject.trim() || mail.subject.length > 200 || /[\r\n]/.test(mail.subject) || !mail.body.trim() || mail.body.length > 12000)) throw new Error('请检查邮件主题和正文。')
      const current = artifact && artifact.inputText === text && resumeTemplateId(artifact.template) === selectedTemplate ? artifact : selectedTemplate === 'original' ? sourcePdf.artifact : null
      const pdf = current ?? await previewJobResume(session, text, company, role, selectedTemplate)
      setArtifact(pdf)
      if (!apply) { setView('pdf'); return }
      const cached = savedRevision.current
      const document = cached?.artifact === pdf && cached.company === company && cached.role === role
        ? cached.document : await saveJobResume(session, text, pdf, { company, role })
      savedRevision.current = { artifact: pdf, company, role, document }
      await onApply({ company, role, subject: mail.subject, body: mail.body, automatic: false }, {
        jobDescription: (draft.jobDescription ?? '').trim(), attachment: document.originalFile,
        attachmentSource: { id: document.id, updatedAt: document.originalFileUpdatedAt ?? document.updatedAt }, attachmentUse: 'preparation',
        tailoredResume: { jobDescription: (draft.jobDescription ?? '').trim(), company, role, sourceFile: file, source, documentId: document.id, text: pdf.text, template: selectedTemplate },
      })
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败。') }
    finally { setBusy(false) }
  }
  const close = () => { controller.current?.abort(); onClose() }
  return <dialog ref={ref} aria-label="按岗位修改简历" onCancel={event => { event.preventDefault(); if (!busy || !session) close() }} className="tailoring-dialog resume-workbench">
    <JobResumeWorkspace
      fileName={file.name} recipient={draft.recipient} session={session} text={text}
      accepted={accepted} edits={edits} originalOrder={originalOrder} view={view} artifact={template === 'original' ? sourcePdf.artifact ?? artifact : artifact} originalFile={isPdf ? file : undefined}
      template={template} onTemplate={value => { if (value !== template) { setTemplate(value); setArtifact(null); if (value === 'original') setView('source'); else { setView('pdf'); void perform(false, value) } } }}
      fields={{ company, role, ...mail }} manualMail={mailEdit.body !== undefined} busy={busy} generating={generating} suggestionError={suggestionError} editingKey={editingKey} error={error || (template === 'original' ? sourcePdf.error ?? '' : '')}
      onSelectLine={setEditingKey} onDeselectLine={() => setEditingKey(null)} onResetLine={resetLine}
      onField={(key, value) => {
        if (key === 'company') { setCompany(value); invalidate() }
        else if (key === 'role') { setRole(value); invalidate() }
        else setMailEdit(current => ({ ...current, [key]: value }))
      }}
      onAccept={key => {
        if (accepted.has(key)) resetLine(key)
        else {
          const change = session?.plan.changes.find(change => tailoringChangeKey(change) === key)
          if (change) editLine(key, change.after)
        }
      }}
      onEdit={editLine}
      onOrder={value => { setOriginalOrder(value); invalidate() }}
      onView={value => { setView(value); if (value === 'source' && template !== 'original') { setTemplate('original'); setArtifact(null) }; if (value === 'pdf' && !artifact) void perform(false) }}
      onRefreshMail={() => setMailEdit(current => ({ ...current, body: undefined }))}
      onRetry={() => setRetry(value => value + 1)} onClose={close} onSave={() => void perform(true)}
    />
  </dialog>
}
