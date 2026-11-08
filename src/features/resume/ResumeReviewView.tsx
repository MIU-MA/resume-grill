'use client'

import type { ReactNode } from 'react'
import { ResumeFitPanel } from './ResumeFitPanel'
import { ArrowLeft, ArrowRight, FileText, Menu, Mail, Settings, Loader2, Download, X } from 'lucide-react'
import type { ExtractedText } from '@/features/resume/lib/pdf'
import { ScrollArea } from '@/components/ui/ScrollArea'
import { Button } from '@/components/ui/Button'
import type { JobContext } from '@/domain/job-context'
import type { JobPreparationIntent } from '@/domain/job-preparation'
import type { ResumeReviewSubmission } from '@/domain/resume-review'
import { ResumeReviewSidebar } from '@/features/resume/ResumeReviewSidebar'
import { ResumeTextEditor } from '@/features/resume/ResumeTextEditor'
import { ResumeDocumentEditor } from './ResumeDocumentEditor'
import type { ResumePdfArtifact } from './lib/resume-pdf'
import { ResumeCandidateList } from '@/features/resume/ResumeCandidateList'
import { ResumeAnalysisOptions } from '@/features/resume/ResumeAnalysisOptions'
import { ResumeDiagnosisStep } from '@/features/resume/ResumeDiagnosisStep'
import { ResumeRevisionPreview, ResumeRevisionToolbar } from './ResumeRevisionPanel'
import type { ResumeRevisionDraft } from './resume-revision'
import { ResumeTemplatePicker } from './ResumeTemplatePicker'
import { SourceResumePhotos } from './SourceResumePhotos'
import { ResumePhotoPicker } from './ResumePhotoPicker'
import type { ResumePhoto } from '@/domain/resume-photo'
import type { ResumeTemplateId } from '@/domain/resume-template'
import { ResumeParagraphEditor } from './ResumeParagraphEditor'
import { useResumeReview } from './use-resume-review'
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
  initialPdfTemplate?: ResumeTemplateId
  initialPhoto?: ResumePhoto
  onSaveRevisionDraft: (draft: ResumeRevisionDraft | null) => Promise<void>
  onSaveRevision: (text: string, preview?: ResumePdfArtifact) => Promise<void>
  onLoadOriginal?: () => Promise<File | undefined>
  onDownloadResume?: () => Promise<void>
  embedded?: boolean
  documentPicker?: ReactNode
  initialTab?: 'diagnosis' | 'structure' | 'raw'
}

export function ResumeReviewView({ sourceFile, demo, extracted, analyzing, error, envConfigured, clientConfigured, onConfirm, onBack, onApplications, initialReview, autoDiagnose, onSaveReview, jobContext, preparationIntent, initialRevisionDraft, initialPdfTemplate, initialPhoto, onSaveRevisionDraft, onSaveRevision, onDownloadResume, onLoadOriginal, embedded, documentPicker, initialTab }: ResumeReviewViewProps) {
  const {
    text, sections, candidates, tab, setTab, writingMode, setWritingMode,
    editingParagraph, setEditingParagraph, analysisGoal, setAnalysisGoal, jobDescription, setJobDescription,
    openSettings, openNav, sidebarOpen, setSidebarOpen, editingId, setEditingId, goalOpen, setGoalOpen,
    jdOpen, setJdOpen, lastDeleted, setLastDeleted, revisionDraft, draftSaveState,
    revisionBusy, photoReading, setPhotoReading, revisionError, previewOpen, setPreviewOpen,
    mobileDocument, setMobileDocument, editRequest, setEditRequest, leaving, downloading, editingText,
    canUseOriginal, original, originalError, setOriginalAttempt,
    template, sourcePhotos, photo, photoUnresolved, pdf, paragraphSections,
    originalParagraphs, revisionPending, revisionConflict, workflowBlocked, diagnosis, selectedCandidates,
    saveState, groupedCandidates,
    updateText, changeTemplate, changeParagraph, changePhoto, resetParagraph, saveRevision, discardRevision,
    leaveReview, downloadResume, updateCandidate, deleteCandidate, undoDelete, selectAll, clearAll,
    keepProjects, scrollToSection, mergeWithNext, addCandidate, submit,
  } = useResumeReview({
    sourceFile, demo, extracted, analyzing, envConfigured, clientConfigured, onConfirm,
    initialReview, autoDiagnose, preparationIntent, onSaveReview, initialRevisionDraft, initialPdfTemplate,
    initialPhoto, onSaveRevisionDraft, onSaveRevision, onLoadOriginal, onDownloadResume, initialTab,
  })
  return (
    <section className="resume-workbench flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <ResumeFitPanel text={editingText} jd={jobDescription} disabled={analyzing || revisionBusy || leaving || revisionConflict} onChange={updateText} />
      <header className="flex h-14 flex-none items-center gap-4 border-b border-line px-4 sm:px-6">
        <button type="button" className="grid size-8 place-items-center text-text-secondary hover:bg-surface-hover md:hidden" onClick={openNav} aria-label="打开导航"><Menu size={16} /></button>
        <strong className="flex-none text-body font-semibold">{embedded ? '简历检查' : 'Resume Grill'}</strong>
        <span className="h-4 w-px flex-none bg-line" />
        <span className="flex min-w-0 flex-1 items-center gap-2 text-meta text-text-secondary">{documentPicker ?? <><FileText size={14} className="flex-none max-sm:hidden" /><span className="truncate">{sourceFile}</span></>}</span>
        <span className="flex-none text-meta text-text-tertiary max-md:hidden">{editingText.length} 字 · {pdf.artifact?.pageCount ?? extracted.pageCount} 页</span>
        <div className="flex flex-none items-center gap-1">
          {onDownloadResume && <Button aria-label="下载简历" title={revisionPending ? '请先保存新稿或放弃修改' : '下载当前简历附件'} className="h-8 px-2.5 text-label" variant="ghost" disabled={workflowBlocked || downloading} onClick={() => { void downloadResume() }}>{downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}<span className="max-sm:hidden">下载简历</span></Button>}
          {!embedded && <Button aria-label="邮箱投递" className="h-8 px-2.5 text-label" variant="ghost" disabled={analyzing || revisionBusy || leaving} onClick={() => { void leaveReview(onApplications) }}><Mail size={15} /><span className="max-sm:hidden">邮箱投递</span></Button>}
          {!embedded && <Button aria-label="模型设置" className="h-8 px-2.5 text-label" variant="ghost" disabled={analyzing || revisionBusy || leaving} onClick={() => openSettings('model')}><Settings size={15} /><span className="max-sm:hidden">模型设置</span></Button>}
          {!embedded && <Button aria-label="返回简历库" className="h-8 px-2.5 text-label" variant="ghost" onClick={() => { void leaveReview(onBack) }} disabled={analyzing || revisionBusy || leaving}><ArrowLeft size={15} /><span className="max-sm:hidden">简历库</span></Button>}
        </div>
      </header>

      {jobContext && <div className="flex flex-none flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-brand-soft px-4 py-2 text-body sm:px-6">
        <strong className="font-medium">{jobContext.company} / {jobContext.role}</strong>
        <span className="text-text-secondary">{sourceFile} · 版本 {jobContext.resumeVersion.slice(0, 8)}</span>
        <button type="button" className="ml-auto text-text-secondary underline underline-offset-4" disabled={analyzing || revisionBusy || leaving} onClick={() => { void leaveReview(onApplications) }}>返回投递清单</button>
      </div>}

      <div className="flex h-12 flex-none items-stretch gap-2 border-b border-line px-4 sm:px-6" role="tablist" aria-label="简历检查视图">
        <ReviewTab active={tab === 'diagnosis'} onClick={() => setTab('diagnosis')}>{jobContext ? '岗位匹配检查' : '简历检查'}</ReviewTab>
        <ReviewTab active={tab === 'structure'} onClick={() => setTab('structure')}>练习内容</ReviewTab>
        <ReviewTab active={tab === 'raw'} onClick={() => setTab('raw')}>修改全文</ReviewTab>
      </div>

      {(tab === 'raw' || revisionDraft) && <div className="resume-edit-layout-row">
        <ResumeTemplatePicker value={template} canUseOriginal={canUseOriginal} preview={{ text: editingText, sourceFile, photo }} disabled={analyzing || revisionBusy || leaving || revisionConflict} onChange={changeTemplate} />
        {template !== 'original' && <details className="resume-photo-settings" open={photoUnresolved && !sourcePhotos.loading ? true : undefined}>
          <summary>{photo ? '照片 · 已保留' : '照片设置'}</summary>
          <div className="space-y-3"><SourceResumePhotos {...sourcePhotos} chosen={photo} disabled={revisionBusy || analyzing} onChange={changePhoto} /><ResumePhotoPicker photo={photo} disabled={analyzing || revisionBusy || leaving || revisionConflict || sourcePhotos.loading} onChange={changePhoto} onReadingChange={setPhotoReading} />{photoUnresolved && !sourcePhotos.loading && <button type="button" className="underline" onClick={() => changePhoto(null)}>确认不放照片</button>}</div>
        </details>}
        {photoUnresolved && <p role="status" className="resume-photo-warning">{sourcePhotos.loading ? '正在读取原文件图片，可先预览排版。' : '请在照片设置中确认要保留的照片，再保存新稿。'}</p>}
      </div>}
      {tab === 'raw' && <div className="flex flex-none items-center gap-4 border-b border-line px-6 py-2 text-body"><span className="mr-auto text-text-tertiary max-sm:hidden">选择段落修改，右侧预览同步更新</span><button type="button" aria-pressed={writingMode === 'paragraphs'} onClick={() => setWritingMode('paragraphs')}>逐条修改</button><button type="button" aria-pressed={writingMode === 'full'} onClick={() => setWritingMode('full')}>全文重写</button></div>}
      {revisionDraft && <ResumeRevisionToolbar text={revisionDraft.text} conflict={revisionConflict} saving={revisionBusy || leaving || analyzing || photoReading} draftStatus={draftSaveState} pdfReady={!!pdf.artifact && !photoUnresolved} error={revisionError} onPreview={() => setPreviewOpen(true)} onSave={() => { void saveRevision() }} onDiscard={() => { void discardRevision() }} />}

      <div className="relative flex min-h-0 flex-1">
        {tab === 'structure' && <>
          {sidebarOpen && <button type="button" className="absolute inset-0 z-30 bg-black/15 min-[900px]:hidden" aria-label="关闭目录" onClick={() => setSidebarOpen(false)} />}
          <div className={['min-h-0 flex-none flex-col border-r border-line bg-surface-soft min-[900px]:flex min-[900px]:w-52', sidebarOpen ? 'absolute inset-y-0 left-0 z-40 flex w-[260px] min-[900px]:static' : 'hidden'].join(' ')}>
            <div className="flex h-12 flex-none items-center justify-between border-b border-line px-5 text-body min-[900px]:hidden">
              文档目录<button type="button" aria-label="收起目录" onClick={() => setSidebarOpen(false)}><X size={16} /></button>
            </div>
            <ResumeReviewSidebar sections={sections} onSectionClick={scrollToSection} />
          </div>
        </>}

        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {tab !== 'structure' ? <>
            <div className="flex flex-none items-center gap-4 border-b border-line px-4 py-2 text-body min-[1100px]:hidden">
              <button type="button" aria-pressed={!mobileDocument} className={!mobileDocument ? 'font-semibold' : 'text-text-tertiary'} onClick={() => setMobileDocument(false)}>{tab === 'raw' ? '全文编辑' : '修改建议'}</button>
              <button type="button" aria-pressed={mobileDocument} className={mobileDocument ? 'font-semibold' : 'text-text-tertiary'} onClick={() => setMobileDocument(true)}>简历预览</button>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] min-[1100px]:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
              <div className={`min-h-0 min-w-0 flex-col ${mobileDocument ? 'hidden min-[1100px]:flex' : 'flex'}`}>
                {tab === 'diagnosis' ? <ResumeDiagnosisStep diagnosis={diagnosis} configured={envConfigured || clientConfigured} demo={demo} analyzing={analyzing || revisionBusy || leaving} jobDescription={jobDescription} onJobDescriptionChange={setJobDescription} onConfigure={() => openSettings('model')} revisionPending={revisionPending || draftSaveState !== 'saved'} onIssueSelect={evidence => setEditRequest({ evidence, time: Date.now() })} renderIssueEditor={evidence => <div className="mt-4"><Button variant="secondary" className="h-8 px-3 text-label" disabled={analyzing || revisionBusy || leaving || revisionConflict || diagnosis.loading} onClick={() => { setEditRequest({ evidence, time: Date.now() }); setMobileDocument(true) }}>定位并修改</Button></div>} />
                  : writingMode === 'full' || !paragraphSections.length ? <ResumeTextEditor text={revisionConflict ? text : editingText} analyzing={analyzing || revisionBusy || leaving || revisionConflict || diagnosis.loading} onTextChange={updateText} /> : <ScrollArea aria-label="简历段落滚动区" className="bg-surface-soft p-4"><ResumeParagraphEditor sections={paragraphSections} originals={originalParagraphs} selected={editingParagraph} disabled={analyzing || revisionBusy || leaving || revisionConflict || diagnosis.loading} onSelect={setEditingParagraph} onChange={changeParagraph} onReset={resetParagraph} /></ScrollArea>}
              </div>
              <div className={`min-h-0 min-w-0 flex-col ${mobileDocument ? 'flex' : 'hidden min-[1100px]:flex'}`}>
                <ResumeDocumentEditor baseText={text} text={editingText} artifact={pdf.artifact} previous={pdf.previous} loading={pdf.loading || (!!onLoadOriginal && !original && !originalError)} error={originalError || pdf.error} disabled={analyzing || revisionBusy || leaving || revisionConflict || diagnosis.loading} request={editRequest} onChange={updateText} onRetry={() => { if (onLoadOriginal && !original) setOriginalAttempt(value => value + 1); else pdf.retry() }} onLoadOriginal={onLoadOriginal} layout={template} />
              </div>
            </div>
          </> : <>
            <div className="flex min-h-16 flex-none flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <button type="button" className="grid size-8 place-items-center text-text-secondary hover:bg-surface-hover min-[900px]:hidden" aria-label="打开文档目录" onClick={() => setSidebarOpen(true)}><Menu size={16} /></button>
                <strong className="text-body font-semibold">练习内容</strong>
                <span className="text-meta text-text-tertiary">{selectedCandidates.length} / {candidates.length} 条</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" className="h-8 px-2.5 text-label" disabled={workflowBlocked} onClick={selectAll}>全选</Button>
                <Button variant="ghost" className="h-8 px-2.5 text-label" disabled={workflowBlocked} onClick={clearAll}>清空</Button>
                <Button variant="ghost" className="h-8 px-2.5 text-label" disabled={workflowBlocked} onClick={keepProjects}>仅项目</Button>
              </div>
            </div>
            <ScrollArea aria-label="练习内容滚动区">
              <div className="mx-auto max-w-[1040px]">
                <ResumeCandidateList groupedCandidates={groupedCandidates} candidates={candidates} sections={sections} editingId={editingId} analyzing={workflowBlocked} onSetEditing={setEditingId} onUpdate={updateCandidate} onMergeWithNext={mergeWithNext} onDelete={deleteCandidate} onAdd={addCandidate} />
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
            </ScrollArea>
          </>}
        </main>
      </div>

      {error && <p role="alert" className="m-0 flex-none border-t border-line px-6 py-2 text-body text-danger">{error}</p>}
      {!revisionDraft && revisionError && <p role="alert" className="m-0 flex-none border-t border-line px-6 py-2 text-body text-danger">{revisionError}</p>}
      {!revisionDraft && draftSaveState === 'error' && <div role="alert" className="flex flex-none items-center gap-3 border-t border-line px-6 py-2 text-body text-danger"><span>已恢复原文，但旧暂存稿未能清除。</span><button type="button" disabled={revisionBusy || leaving || analyzing} className="underline underline-offset-4" onClick={() => { void discardRevision() }}>重试清除</button></div>}
      {!(tab === 'raw' && revisionDraft) && <footer className="flex min-h-14 flex-none flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-soft px-4 py-2.5 sm:px-6">
        <span className="flex flex-col gap-1 text-meta text-text-tertiary" role="status">
          <span className={saveState === 'error' ? 'text-danger' : ''}>{saveState === 'saving' ? '正在保存到本地…' : saveState === 'saved' ? '已保存到此浏览器' : '本地保存失败，请导出检查结果备份。'}</span>
          {revisionPending ? '保存新稿后可以重新检查或练习。' : tab === 'raw' ? '原文件保留，修改另存为新稿。' : selectedCandidates.length > 0 ? `已选 ${selectedCandidates.length} 条练习内容` : '到「练习内容」中选几条经历。'}
        </span>
        {tab !== 'raw' && <div className="flex items-center gap-2">
          <Button variant="primary" className="h-9 whitespace-nowrap px-4 text-label" disabled={workflowBlocked || selectedCandidates.length === 0} onClick={submit}>
            {analyzing ? <Loader2 size={14} className="animate-spin" /> : null}
            {analyzing ? '正在准备练习' : diagnosis.loading ? '跳过检查，准备面试' : '准备面试内容'}{!analyzing && <ArrowRight size={14} />}
          </Button>
        </div>}
      </footer>}

      {revisionDraft && <ResumeRevisionPreview open={previewOpen} baseText={revisionDraft.baseText} text={revisionDraft.text} artifact={pdf.artifact} error={pdf.error} onClose={() => setPreviewOpen(false)} />}
      {lastDeleted && <div className="fixed bottom-16 left-1/2 z-50 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3 border border-line-strong bg-white px-4 py-2.5">
        <span className="truncate text-meta text-text-secondary">已删除：{lastDeleted.candidate.content.slice(0, 24)}</span>
        <button type="button" disabled={workflowBlocked} onClick={undoDelete} className="text-label text-brand disabled:opacity-40">撤销</button>
        <button type="button" onClick={() => setLastDeleted(null)} aria-label="关闭"><X size={14} /></button>
      </div>}
    </section>
  )
}

function ReviewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} className={['border-b-2 px-3 text-label font-medium', active ? 'border-brand text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'].join(' ')}>
      {children}
    </button>
  )
}
