'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { SidebarBadges } from '@/features/workspace/WorkspaceSidebar'
import { AppShell, type SettingsTab } from '@/features/workspace/AppShell'
import { ResumeReviewView } from '@/features/resume/ResumeReviewView'
import { CreateResumeDialog } from '@/features/resume/CreateResumeDialog'
import { extractTextFromFile } from '@/features/resume/lib/pdf'
import { loadResumeCheckWorkspace, selectResumeCheckDocument } from '@/features/resume/lib/resume-check-workspace'
import { importResumeDocument, saveResumeRevisionDraft, updateResumeDocument, type ResumeDocument } from '@/features/resume/lib/resume-library'
import { createResumeRevision, downloadResumeFile } from '@/features/resume/lib/resume-revision'
import type { ResumeReviewSubmission } from '@/domain/resume-review'
import type { Mode } from '../../application/types'

type Props = {
  badges: SidebarBadges; envConfigured: boolean; clientConfigured: boolean
  onClientChanged: () => void; onNavigate: (mode: Mode) => void; onHome: () => void
  onPractice: (document: ResumeDocument, review: ResumeReviewSubmission) => Promise<void>
}

/** Independent document selection and review state; never reads the active job/interview record. */
export function ResumeCheckWorkspace(props: Props) {
  const [document, setDocument] = useState<ResumeDocument | null>(null)
  const [documents, setDocuments] = useState<ResumeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('model')
  const [creating, setCreating] = useState(false)
  const openSettings = (tab: SettingsTab) => { setSettingsTab(tab); setSettingsOpen(true) }
  const currentId = useRef<string | undefined>(undefined)
  const input = useRef<HTMLInputElement>(null)
  currentId.current = document?.id
  useEffect(() => {
    let active = true
    void loadResumeCheckWorkspace().then(value => { if (active) { setDocuments(value.documents); setDocument(value.selected) } })
      .catch(() => { if (active) setError('简历读取失败，请重新打开或导入。') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const remember = (value: ResumeDocument) => {
    if (value.jobContext || value.id.startsWith('resume-document:tailoring-source:')) throw new Error('岗位文档请从对应投递记录打开。')
    setDocuments(current => [value, ...current.filter(item => item.id !== value.id)])
    setDocument(value); currentId.current = value.id; setError('')
    return selectResumeCheckDocument(value)
  }
  const updateLocal = (id: string, patch: Partial<ResumeDocument>) => {
    setDocument(current => current?.id === id ? { ...current, ...patch } : current)
    setDocuments(current => current.map(item => item.id === id ? { ...item, ...patch } : item))
  }
  const create = () => { setError(''); setCreating(true) }
  const upload = async (file?: File) => {
    if (!file) return
    setBusy(true); setError('')
    try { const extracted = await extractTextFromFile(file); await remember(await importResumeDocument(extracted, file.name, false, file, { select: false })) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '简历导入失败。') }
    finally { setBusy(false); if (input.current) input.current.value = '' }
  }
  const picker = <>
    <select aria-label="选择要检查的简历" value={document?.id ?? ''} className="min-w-0 max-w-64 flex-1 border border-line bg-white px-2 py-1.5" disabled={busy || loading} onChange={event => {
      const next = documents.find(item => item.id === event.target.value)
      if (next) void remember(next).catch(() => setError('选择尚未保存，请重试。'))
    }}>{documents.map(item => <option key={item.id} value={item.id}>{item.sourceFile}</option>)}</select>
    <button type="button" disabled={busy || loading} onClick={() => void create()} className="flex items-center gap-1 whitespace-nowrap" aria-label="新建简历"><Plus size={13} /><span className="max-sm:hidden">新建</span></button>
    <button type="button" disabled={busy || loading} onClick={() => input.current?.click()} className="flex items-center gap-1 whitespace-nowrap" aria-label="导入简历"><Upload size={13} /><span className="max-sm:hidden">导入</span></button>
  </>
  return <AppShell
    mode="diagnosis"
    badges={props.badges}
    onNavigate={props.onNavigate}
    onOpenHistory={props.onHome}
    settingsOpen={settingsOpen}
    settingsTab={settingsTab}
    onOpenSettings={openSettings}
    onCloseSettings={() => setSettingsOpen(false)}
    settings={{ envConfigured: props.envConfigured, clientConfigured: props.clientConfigured, onClientChanged: props.onClientChanged }}
    headerless={!!document}
    header={<div className="flex min-w-0 flex-1 items-center gap-2"><strong className="text-body">简历检查</strong></div>}
  >
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="独立简历检查">
      <input ref={input} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" aria-label="上传要检查的简历" onChange={event => void upload(event.target.files?.[0])} />
      {loading ? <p role="status" className="p-6 text-body text-text-tertiary">正在读取简历…</p> : document ? <ResumeReviewView
        key={document.id} embedded documentPicker={picker} initialTab={!document.extracted.text.trim() ? 'raw' : 'diagnosis'}
        sourceFile={document.sourceFile} demo={document.demo} extracted={document.extracted}
        initialReview={document.review} initialRevisionDraft={document.revisionDraft} initialPdfTemplate={document.pdfTemplate} initialPhoto={document.photo}
        analyzing={busy} error={error || null} autoDiagnose={false}
        envConfigured={props.envConfigured} clientConfigured={props.clientConfigured} onClientChanged={props.onClientChanged}
        onBack={props.onHome} onApplications={() => props.onNavigate('applications')}
        onSaveReview={async review => { const id = document.id; await updateResumeDocument(id, { review }); updateLocal(id, { review }) }}
        onSaveRevisionDraft={async draft => { const id = document.id; await saveResumeRevisionDraft(id, draft); updateLocal(id, { revisionDraft: draft ?? undefined }) }}
        onSaveRevision={async (text, preview) => {
          const id = document.id
          const revision = await createResumeRevision(id, text, document.review?.rawText ?? document.extracted.text, preview, { allowUnchanged: !!preview?.template })
          if (currentId.current === id) await remember(revision)
          else setDocuments(current => [revision, ...current])
          downloadResumeFile(revision.originalFile!)
        }}
        onLoadOriginal={document.originalFile ? async () => document.originalFile : undefined}
        onDownloadResume={document.originalFile ? async () => downloadResumeFile(document.originalFile!) : undefined}
        onConfirm={review => {
          const snapshot = document
          setBusy(true)
          void updateResumeDocument(snapshot.id, { review }).then(() => props.onPractice({ ...snapshot, review }, review))
            .catch(cause => setError(cause instanceof Error ? cause.message : '练习准备失败。')).finally(() => setBusy(false))
        }}
      /> : <div className="m-auto max-w-md px-6 py-12 text-center"><h1 className="text-title font-semibold">简历检查</h1><p className="my-4 text-body leading-relaxed text-text-secondary">导入简历直接修改，或使用已有的个人资料和经历生成一份新简历。</p><div className="flex justify-center gap-3"><Button disabled={busy} onClick={() => input.current?.click()}>导入简历</Button><Button variant="secondary" disabled={busy} onClick={create}>新建简历</Button></div>{error && <p role="alert" className="text-body text-danger">{error}</p>}</div>}
    </div>
    {creating && <CreateResumeDialog source={document} onClose={() => setCreating(false)} onCreated={async (value, warning) => { await remember(value); setCreating(false); if (warning) setError(warning) }} />}
  </AppShell>
}