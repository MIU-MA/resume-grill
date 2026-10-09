'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Menu,
  Mail,
  Settings,
  Loader2,
  Download,
  X,
} from 'lucide-react'
import type { ExtractedText } from '@/features/resume/lib/pdf'
import { Button } from '@/components/ui/Button'
import { WorkbenchFrame } from '@/components/layout/WorkbenchFrame'
import type { AnalysisGoal } from '@/domain/analysis-config'
import type { JobContext } from '@/domain/job-context'
import type { JobPreparationIntent } from '@/domain/job-preparation'
import { parseResumeStructure } from '@/domain/resume-structure'
import type { ResumeReviewSubmission } from '@/domain/resume-review'
import type { ReviewCandidate } from '@/features/resume/resume-review-types'
import {
  createReviewCandidates,
  groupCandidates,
} from '@/features/resume/resume-review-utils'
import { ResumeReviewSidebar } from '@/features/resume/ResumeReviewSidebar'
import { ResumeTextEditor } from '@/features/resume/ResumeTextEditor'
import { ResumeDocumentEditor } from './ResumeDocumentEditor'
import { useResumePdf } from './hooks/use-resume-pdf'
import type { ResumePdfArtifact } from './lib/resume-pdf'
import { ResumeCandidateList } from '@/features/resume/ResumeCandidateList'
import { ResumeAnalysisOptions } from '@/features/resume/ResumeAnalysisOptions'
import { ResumeDiagnosisStep } from '@/features/resume/ResumeDiagnosisStep'
import { SettingsDialog } from '@/features/settings/SettingsDialog'
import { useResumeDiagnosis } from '@/features/resume/hooks/use-resume-diagnosis'
import { ResumeRevisionPreview, ResumeRevisionToolbar } from './ResumeRevisionPanel'
import type { ResumeRevisionDraft } from './resume-revision'

type ResumeReviewViewProps = {
  sourceFile: string
  demo: boolean
  extracted: ExtractedText
  analyzing: boolean
  error: string | null
  envConfigured: boolean
  clientConfigured: boolean
  onClientChanged: () => void
  onConfirm: (submission: ResumeReviewSubmission, sourceFile: string) => void
  onBack: () => void
  onApplications: () => void
  initialReview?: ResumeReviewSubmission
  autoDiagnose?: boolean
  jobContext?: JobContext
  preparationIntent?: JobPreparationIntent
  onSaveReview: (review: ResumeReviewSubmission) => Promise<void>
  initialRevisionDraft?: ResumeRevisionDraft
  onSaveRevisionDraft: (draft: ResumeRevisionDraft | null) => Promise<void>
  onSaveRevision: (text: string, preview?: ResumePdfArtifact) => Promise<void>
  onLoadOriginal?: () => Promise<File | undefined>
  onDownloadResume?: () => Promise<void>
}

export function ResumeReviewView({ sourceFile, demo, extracted, analyzing, error, envConfigured, clientConfigured, onClientChanged, onConfirm, onBack, onApplications, initialReview, autoDiagnose, onSaveReview, jobContext, preparationIntent, initialRevisionDraft, onSaveRevisionDraft, onSaveRevision, onDownloadResume, onLoadOriginal }: ResumeReviewViewProps) {
  const [text] = useState(() => (initialReview?.rawText ?? extracted.text).trim())
  const sections = useMemo(() => parseResumeStructure(text), [text])
  const [candidates, setCandidates] = useState<ReviewCandidate[]>(() => initialReview?.candidateDrafts ?? (initialReview ? initialReview.reviewedCandidates.map((candidate, index) => ({ ...candidate, id: `saved-${index}`, enabled: true })) : createReviewCandidates(extracted.text)))
  const [tab, setTab] = useState<'diagnosis' | 'structure' | 'raw'>(preparationIntent === 'interview' ? 'structure' : 'diagnosis')
  const [analysisGoal, setAnalysisGoal] = useState<AnalysisGoal>(initialReview?.analysisGoal ?? 'overall')
  const [jobDescription, setJobDescription] = useState(initialReview?.jobDescription ?? '')
  const [settingsOpen, setSettingsOpen] = useState(preparationIntent === 'interview' && !envConfigured && !clientConfigured)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [goalOpen, setGoalOpen] = useState(false)
  const [jdOpen, setJdOpen] = useState(false)
  const [lastDeleted, setLastDeleted] = useState<{ candidate: ReviewCandidate; index: number } | null>(null)
  const [revisionDraft, setRevisionDraft] = useState<ResumeRevisionDraft | null>(initialRevisionDraft ?? null)
  const [draftSaveState, setDraftSaveState] = useState<'saving' | 'saved' | 'error'>('saved')
  const [revisionBusy, setRevisionBusy] = useState(false)
  const [revisionError, setRevisionError] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [mobileDocument, setMobileDocument] = useState(false)
  const [editRequest, setEditRequest] = useState<{ evidence: string; time: number } | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const revisionQueue = useRef<Promise<void>>(Promise.resolve())
  const revisionSequence = useRef(0)
  const revisionAction = useRef(false)
  const editingText = revisionDraft?.text ?? text
  const pdf = useResumePdf(editingText, sourceFile, tab !== 'structure' || revisionDraft !== null)
  const revisionPending = revisionDraft !== null
  const revisionConflict = revisionDraft !== null && revisionDraft.baseText !== text
  const workflowBlocked = analyzing || revisionPending || revisionBusy || leaving || draftSaveState !== 'saved'
  const diagnosis = useResumeDiagnosis(text, jobDescription, envConfigured || clientConfigured, demo, { report: initialReview?.diagnosis, autoRun: initialRevisionDraft ? false : autoDiagnose })

  const selectedCandidates = useMemo(() => candidates.filter((candidate) => candidate.enabled && candidate.content.trim().length >= 2), [candidates])
  const review = useMemo<ResumeReviewSubmission>(() => ({ rawText: text.trim(), analysisGoal, jobDescription: jobDescription.trim(), diagnosis: diagnosis.report ?? undefined, candidateDrafts: candidates, reviewedCandidates: selectedCandidates.map(({ content, sourceSection, lineNumber }) => ({ content: content.trim(), sourceSection, lineNumber })) }), [text, analysisGoal, jobDescription, diagnosis.report, selectedCandidates, candidates])
  const saveRef = useRef(onSaveReview)
  saveRef.current = onSaveReview
  const [saveState, setSaveState] = useState<'saving' | 'saved' | 'error'>('saving')
  useEffect(() => {
    let active = true
    setSaveState('saving')
    void saveRef.current(review).then(() => { if (active) setSaveState('saved') }).catch(() => { if (active) setSaveState('error') })
    return () => { active = false }
  }, [review])
  const groupedCandidates = useMemo(() => groupCandidates(candidates), [candidates])
  const projectSectionTitles = useMemo(
    () =>
      new Set(
        sections
          .filter((section) => ['work', 'internship', 'project'].includes(section.kind))
          .map((section) => section.title),
      ),
    [sections],
  )
  const persistRevisionDraft = (draft: ResumeRevisionDraft | null) => {
    const sequence = ++revisionSequence.current
    const persist = onSaveRevisionDraft
    setDraftSaveState('saving')
    // Serialize writes so a slow earlier edit cannot overwrite a newer edit or a discard.
    const saving = revisionQueue.current.catch(() => {}).then(() => persist(draft))
    revisionQueue.current = saving
    void saving.then(() => {
      if (revisionSequence.current === sequence) setDraftSaveState('saved')
    }, () => {
      if (revisionSequence.current === sequence) setDraftSaveState('error')
    })
    return saving
  }

  const updateText = (value: string) => {
    if (analyzing || revisionAction.current || leaving || revisionConflict) return
    diagnosis.cancel()
    const draft = value === text ? null : { baseText: text, text: value }
    setRevisionDraft(draft)
    setRevisionError(null)
    void persistRevisionDraft(draft)
  }

  const saveRevision = async () => {
    if (!revisionDraft || revisionConflict || revisionAction.current || analyzing) return
    if (!pdf.artifact) { setRevisionError(pdf.error ?? 'PDF 还在更新，请稍后保存。'); return }
    revisionAction.current = true
    setRevisionBusy(true)
    setRevisionError(null)
    diagnosis.cancel()
    try {
      await revisionQueue.current.catch(() => {})
      await onSaveRevision(revisionDraft.text, pdf.artifact)
    } catch (cause) {
      setRevisionError(cause instanceof Error ? cause.message : '新稿保存失败，请重试。')
    } finally {
      revisionAction.current = false
      setRevisionBusy(false)
    }
  }

  const discardRevision = async () => {
    if (revisionAction.current || analyzing) return
    revisionAction.current = true
    setRevisionBusy(true)
    setRevisionError(null)
    try {
      await persistRevisionDraft(null)
      setRevisionDraft(null)
      setPreviewOpen(false)
    } catch {
      setRevisionError('暂存稿未能清除，请重试。')
    } finally {
      revisionAction.current = false
      setRevisionBusy(false)
    }
  }

  const leaveReview = async (navigate: () => void) => {
    if (revisionAction.current || analyzing || leaving) return
    setLeaving(true)
    try {
      await revisionQueue.current
      navigate()
    } catch {
      setRevisionError('修改尚未保存到本地，请先保存新稿或放弃修改。')
    } finally { setLeaving(false) }
  }

  const downloadResume = async () => {
    if (!onDownloadResume || downloading || revisionPending || revisionBusy) return
    setDownloading(true)
    setRevisionError(null)
    try { await onDownloadResume() }
    catch (cause) { setRevisionError(cause instanceof Error ? cause.message : '下载失败，请重试。') }
    finally { setDownloading(false) }
  }

  useEffect(() => {
    if (draftSaveState === 'saved') return
    const warnUnsaved = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warnUnsaved)
    return () => window.removeEventListener('beforeunload', warnUnsaved)
  }, [draftSaveState])

  const updateCandidate = (id: string, changes: Partial<ReviewCandidate>) => {
    setCandidates((current) => current.map((candidate) => candidate.id === id ? { ...candidate, ...changes } : candidate))
  }

  const deleteCandidate = (id: string) => {
    setCandidates((current) => {
      const index = current.findIndex((candidate) => candidate.id === id)
      const candidate = current[index]
      if (!candidate) return current
      setLastDeleted({ candidate, index })
      return current.filter((item) => item.id !== id)
    })
  }

  const undoDelete = () => {
    if (!lastDeleted) return
    setCandidates((current) => {
      const next = [...current]
      next.splice(Math.min(lastDeleted.index, next.length), 0, lastDeleted.candidate)
      return next
    })
    setLastDeleted(null)
  }

  const selectAll = () =>
    setCandidates((current) => current.map((candidate) => ({ ...candidate, enabled: true })))
  const clearAll = () =>
    setCandidates((current) => current.map((candidate) => ({ ...candidate, enabled: false })))
  const keepProjects = () =>
    setCandidates((candidateList) =>
      candidateList.map((candidate) => ({
        ...candidate,
        enabled: projectSectionTitles.has(candidate.sourceSection),
      })),
    )

  const scrollToSection = (index: number) => {
    setSidebarOpen(false)
    if (tab !== 'structure') setTab('structure')
    // 切到结构视图后等待渲染再滚动
    setTimeout(() => {
      document.getElementById(`resume-section-${index}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, tab === 'structure' ? 0 : 30)
  }

  const mergeWithNext = (id: string) => {
    setCandidates((current) => {
      const index = current.findIndex((candidate) => candidate.id === id)
      const candidate = current[index]
      const next = current[index + 1]
      if (!candidate || !next || candidate.sourceSection !== next.sourceSection) return current
      const merged = {
        ...candidate,
        content: `${candidate.content.replace(/[；;。]\s*$/, '')}；${next.content}`,
        enabled: candidate.enabled || next.enabled,
      }
      return [...current.slice(0, index), merged, ...current.slice(index + 2)]
    })
  }

  const submit = () => {
    if (workflowBlocked || selectedCandidates.length === 0) return
    if (!demo && !envConfigured && !clientConfigured) {
      setSettingsOpen(true)
      return
    }
    diagnosis.cancel()
    onConfirm(review, sourceFile)
  }

  return (
    <WorkbenchFrame className="flex flex-col">
      <header className="flex h-14 flex-none items-center gap-4 border-b border-line px-4 sm:px-6">
        <strong className="flex-none text-[14px] font-semibold">Resume Grill</strong>
        <span className="h-4 w-px flex-none bg-line" />
        <span className="flex min-w-0 flex-1 items-center gap-2 text-[12px] text-text-secondary"><FileText size={14} className="flex-none max-sm:hidden" /><span className="truncate">{sourceFile}</span></span>
        <span className="flex-none text-[12px] text-text-tertiary max-md:hidden">{text.length} 字 · {extracted.pageCount} 页</span>
        <div className="flex flex-none items-center gap-1">
          {onDownloadResume && <Button aria-label="下载简历" title={revisionPending ? '请先保存新稿或放弃修改' : '下载当前简历附件'} className="h-8 px-2.5 text-[12px]" variant="ghost" disabled={workflowBlocked || downloading} onClick={() => { void downloadResume() }}>{downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}<span className="max-sm:hidden">下载简历</span></Button>}
          <Button aria-label="邮箱投递" className="h-8 px-2.5 text-[12px]" variant="ghost" disabled={analyzing || revisionBusy || leaving} onClick={() => { void leaveReview(onApplications) }}><Mail size={15} /><span className="max-sm:hidden">邮箱投递</span></Button>
          <Button aria-label="模型设置" className="h-8 px-2.5 text-[12px]" variant="ghost" disabled={analyzing || revisionBusy || leaving} onClick={() => setSettingsOpen(true)}><Settings size={15} /><span className="max-sm:hidden">模型设置</span></Button>
          <Button aria-label="返回简历库" className="h-8 px-2.5 text-[12px]" variant="ghost" onClick={() => { void leaveReview(onBack) }} disabled={analyzing || revisionBusy || leaving}><ArrowLeft size={15} /><span className="max-sm:hidden">简历库</span></Button>
        </div>
      </header>

      {jobContext && <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-brand-soft px-4 py-2 text-[12px] sm:px-6">
        <strong className="font-medium">{jobContext.company} / {jobContext.role}</strong>
        <span className="text-text-secondary">{sourceFile} · 版本 {jobContext.resumeVersion.slice(0, 8)}</span>
        <button type="button" className="ml-auto text-text-secondary underline underline-offset-4" disabled={analyzing || revisionBusy || leaving} onClick={() => { void leaveReview(onApplications) }}>返回投递清单</button>
      </div>}

      <div className="flex h-12 flex-none items-stretch gap-2 border-b border-line px-4 sm:px-6" role="tablist" aria-label="简历检查视图">
        <ReviewTab active={tab === 'diagnosis'} onClick={() => setTab('diagnosis')}>简历检查</ReviewTab>
        <ReviewTab active={tab === 'structure'} onClick={() => setTab('structure')}>练习内容</ReviewTab>
        <ReviewTab active={tab === 'raw'} onClick={() => setTab('raw')}>修改全文</ReviewTab>
      </div>

      {revisionDraft && <ResumeRevisionToolbar text={revisionDraft.text} conflict={revisionConflict} saving={revisionBusy || leaving || analyzing} draftStatus={draftSaveState} pdfReady={!!pdf.artifact} error={revisionError} onPreview={() => setPreviewOpen(true)} onSave={() => { void saveRevision() }} onDiscard={() => { void discardRevision() }} />}

      <div className="relative flex min-h-0 flex-1">
        {tab === 'structure' && <>
          {sidebarOpen && <button type="button" className="absolute inset-0 z-30 bg-black/15 min-[900px]:hidden" aria-label="关闭目录" onClick={() => setSidebarOpen(false)} />}
          <div className={['min-h-0 flex-none flex-col border-r border-line bg-surface-soft min-[900px]:flex min-[900px]:w-52', sidebarOpen ? 'absolute inset-y-0 left-0 z-40 flex w-[260px] min-[900px]:static' : 'hidden'].join(' ')}>
            <div className="flex h-12 flex-none items-center justify-between border-b border-line px-5 text-[13px] min-[900px]:hidden">
              文档目录<button type="button" aria-label="收起目录" onClick={() => setSidebarOpen(false)}><X size={16} /></button>
            </div>
            <ResumeReviewSidebar sections={sections} sectionTitles={groupedCandidates.map(([title]) => title)} onSectionClick={scrollToSection} />
          </div>
        </>}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {tab !== 'structure' ? <>
            <div className="flex flex-none items-center gap-4 border-b border-line px-4 py-2 text-[12px] min-[1100px]:hidden">
              <button type="button" aria-pressed={!mobileDocument} className={!mobileDocument ? 'font-semibold' : 'text-text-tertiary'} onClick={() => setMobileDocument(false)}>{tab === 'raw' ? '全文编辑' : '修改建议'}</button>
              <button type="button" aria-pressed={mobileDocument} className={mobileDocument ? 'font-semibold' : 'text-text-tertiary'} onClick={() => setMobileDocument(true)}>简历预览</button>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 min-[1100px]:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
              <div className={`min-h-0 min-w-0 flex-col ${mobileDocument ? 'hidden min-[1100px]:flex' : 'flex'}`}>
                {tab === 'diagnosis' ? <ResumeDiagnosisStep diagnosis={diagnosis} configured={envConfigured || clientConfigured} demo={demo} analyzing={analyzing || revisionBusy || leaving} jobDescription={jobDescription} onJobDescriptionChange={setJobDescription} onConfigure={() => setSettingsOpen(true)} revisionPending={revisionPending || draftSaveState !== 'saved'} onIssueSelect={evidence => setEditRequest({ evidence, time: Date.now() })} renderIssueEditor={evidence => <div className="mt-4"><Button variant="secondary" className="h-8 px-3 text-[12px]" disabled={analyzing || revisionBusy || leaving || revisionConflict || diagnosis.loading} onClick={() => { setEditRequest({ evidence, time: Date.now() }); setMobileDocument(true) }}>定位并修改</Button></div>} />
                  : <ResumeTextEditor text={revisionConflict ? text : editingText} analyzing={analyzing || revisionBusy || leaving || revisionConflict || diagnosis.loading} onTextChange={updateText} />}
              </div>
              <div className={`min-h-0 min-w-0 flex-col ${mobileDocument ? 'flex' : 'hidden min-[1100px]:flex'}`}>
                <ResumeDocumentEditor baseText={text} text={editingText} artifact={pdf.artifact} previous={pdf.previous} loading={pdf.loading} error={pdf.error} disabled={analyzing || revisionBusy || leaving || revisionConflict || diagnosis.loading} request={editRequest} onChange={updateText} onRetry={pdf.retry} onLoadOriginal={onLoadOriginal} />
              </div>
            </div>
          </> : <>
            <div className="flex min-h-16 flex-none flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <button type="button" className="grid size-8 place-items-center text-text-secondary hover:bg-surface-hover min-[900px]:hidden" aria-label="打开文档目录" onClick={() => setSidebarOpen(true)}><Menu size={16} /></button>
                <strong className="text-[14px] font-semibold">练习内容</strong>
                <span className="text-[12px] text-text-tertiary">{selectedCandidates.length} / {candidates.length} 条</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" className="h-8 px-2.5 text-[12px]" disabled={workflowBlocked} onClick={selectAll}>全选</Button>
                <Button variant="ghost" className="h-8 px-2.5 text-[12px]" disabled={workflowBlocked} onClick={clearAll}>清空</Button>
                <Button variant="ghost" className="h-8 px-2.5 text-[12px]" disabled={workflowBlocked} onClick={keepProjects}>仅项目</Button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="mx-auto max-w-[1040px]">
                <ResumeCandidateList groupedCandidates={groupedCandidates} candidates={candidates} sections={sections} editingId={editingId} analyzing={workflowBlocked} onSetEditing={setEditingId} onUpdate={updateCandidate} onMergeWithNext={mergeWithNext} onDelete={deleteCandidate} />
                <ResumeAnalysisOptions
                  analysisGoal={analysisGoal}
                  goalOpen={goalOpen}
                  jobDescription={jobDescription}
                  jobDescriptionOpen={jdOpen}
                  analyzing={workflowBlocked}
                  onToggleGoal={() => setGoalOpen((open) => !open)}
                  onGoalChange={setAnalysisGoal}
                  onToggleJobDescription={() => setJdOpen((open) => !open)}
                  onJobDescriptionChange={setJobDescription}
                />
              </div>
            </div>
          </>}
        </main>
      </div>

      {error && <p role="alert" className="m-0 flex-none border-t border-line px-6 py-2 text-[12px] text-danger">{error}</p>}
      {!revisionDraft && revisionError && <p role="alert" className="m-0 flex-none border-t border-line px-6 py-2 text-[12px] text-danger">{revisionError}</p>}
      {!revisionDraft && draftSaveState === 'error' && <div role="alert" className="flex flex-none items-center gap-3 border-t border-line px-6 py-2 text-[12px] text-danger"><span>已恢复原文，但旧暂存稿未能清除。</span><button type="button" disabled={revisionBusy || leaving || analyzing} className="underline underline-offset-4" onClick={() => { void discardRevision() }}>重试清除</button></div>}
      <footer className="flex min-h-14 flex-none flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-soft px-4 py-2.5 sm:px-6">
        <span className="flex flex-col gap-1 text-[12px] text-text-tertiary" role="status">
          <span className={saveState === 'error' ? 'text-danger' : ''}>{saveState === 'saving' ? '正在保存到本地…' : saveState === 'saved' ? '已保存到此浏览器' : '本地保存失败，请导出检查结果备份。'}</span>
          {revisionPending ? '保存新稿后可以重新检查或练习。' : selectedCandidates.length > 0 ? `已选 ${selectedCandidates.length} 条练习内容` : '到「练习内容」中选几条经历。'}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="primary" className="h-9 whitespace-nowrap px-4 text-[13px]" disabled={workflowBlocked || selectedCandidates.length === 0} onClick={submit}>
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : null}
            {analyzing ? '正在准备练习' : diagnosis.loading ? '跳过检查，进入练习' : '进入面试练习'}{!analyzing && <ArrowRight size={14} />}
          </Button>
        </div>
      </footer>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} envConfigured={envConfigured} clientConfigured={clientConfigured} onClientChanged={onClientChanged} />
      {revisionDraft && <ResumeRevisionPreview open={previewOpen} baseText={revisionDraft.baseText} text={revisionDraft.text} artifact={pdf.artifact} error={pdf.error} onClose={() => setPreviewOpen(false)} />}
      {lastDeleted && <div className="fixed bottom-16 left-1/2 z-50 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 border border-line-strong bg-white px-4 py-2.5">
        <span className="truncate text-[12px] text-text-secondary">已删除：{lastDeleted.candidate.content.slice(0, 24)}</span>
        <button type="button" disabled={workflowBlocked} onClick={undoDelete} className="text-[12px] text-brand disabled:opacity-40">撤销</button>
        <button type="button" onClick={() => setLastDeleted(null)} aria-label="关闭"><X size={14} /></button>
      </div>}
    </WorkbenchFrame>
  )
}

function ReviewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={['border-b-2 px-3 text-[13px] font-medium', active ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'].join(' ')}>
      {children}
    </button>
  )
}
