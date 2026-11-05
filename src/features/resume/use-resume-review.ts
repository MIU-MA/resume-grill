'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ExtractedText } from '@/features/resume/lib/pdf'
import type { AnalysisGoal } from '@/domain/analysis-config'
import type { JobPreparationIntent } from '@/domain/job-preparation'
import { parseResumeStructure } from '@/domain/resume-structure'
import type { ResumeReviewSubmission } from '@/domain/resume-review'
import type { ReviewCandidate } from '@/features/resume/resume-review-types'
import { createReviewCandidates, groupCandidates, includeReviewLine } from '@/features/resume/resume-review-utils'
import { useResumePdf } from './hooks/use-resume-pdf'
import type { ResumePdfArtifact } from './lib/resume-pdf'
import { useAppShell } from '@/features/workspace/app-shell-context'
import { useResumeDiagnosis } from '@/features/resume/hooks/use-resume-diagnosis'
import type { ResumeRevisionDraft } from './resume-revision'
import { useSourceResumePhotos } from './hooks/use-source-resume-photos'
import { sameResumePhoto, type ResumePhoto } from '@/domain/resume-photo'
import { resumeTemplateId, type ResumeTemplateId } from '@/domain/resume-template'
import { tailoringSections, tailoringSourceRanges } from '@/domain/resume-tailoring'

type Args = {
  sourceFile: string
  demo: boolean
  extracted: ExtractedText
  analyzing: boolean
  envConfigured: boolean
  clientConfigured: boolean
  onConfirm: (submission: ResumeReviewSubmission, sourceFile: string) => void
  initialReview?: ResumeReviewSubmission
  autoDiagnose?: boolean
  preparationIntent?: JobPreparationIntent
  onSaveReview: (review: ResumeReviewSubmission) => Promise<void>
  initialRevisionDraft?: ResumeRevisionDraft
  initialPdfTemplate?: ResumeTemplateId
  initialPhoto?: ResumePhoto
  onSaveRevisionDraft: (draft: ResumeRevisionDraft | null) => Promise<void>
  onSaveRevision: (text: string, preview?: ResumePdfArtifact) => Promise<void>
  onLoadOriginal?: () => Promise<File | undefined>
  onDownloadResume?: () => Promise<void>
  initialTab?: 'diagnosis' | 'structure' | 'raw'
}

/**
 * State and actions for the review page; the view only owns JSX.
 */
export function useResumeReview({ sourceFile, demo, extracted, analyzing, envConfigured, clientConfigured, onConfirm, initialReview, autoDiagnose, preparationIntent, onSaveReview, initialRevisionDraft, initialPdfTemplate, initialPhoto, onSaveRevisionDraft, onSaveRevision, onLoadOriginal, onDownloadResume, initialTab }: Args) {
  const [text] = useState(() => (initialReview?.rawText ?? extracted.text).trim())
  const sections = useMemo(() => parseResumeStructure(text), [text])
  const [candidates, setCandidates] = useState<ReviewCandidate[]>(() => initialReview?.candidateDrafts ?? (initialReview ? initialReview.reviewedCandidates.map((candidate, index) => ({ ...candidate, id: `saved-${index}`, enabled: true })) : createReviewCandidates(extracted.text)))
  const [tab, setTab] = useState<'diagnosis' | 'structure' | 'raw'>(initialTab ?? (preparationIntent === 'interview' ? 'structure' : 'diagnosis'))
  const [writingMode, setWritingMode] = useState<'paragraphs' | 'full'>(() => text.trim() ? 'paragraphs' : 'full')
  const [editingParagraph, setEditingParagraph] = useState<string | null>(null)
  const [analysisGoal, setAnalysisGoal] = useState<AnalysisGoal>(initialReview?.analysisGoal ?? 'overall')
  const [jobDescription, setJobDescription] = useState(initialReview?.jobDescription ?? '')
  const { openSettings, openNav } = useAppShell()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [goalOpen, setGoalOpen] = useState(false)
  const [jdOpen, setJdOpen] = useState(false)
  const [lastDeleted, setLastDeleted] = useState<{ candidate: ReviewCandidate; index: number } | null>(null)
  const [revisionDraft, setRevisionDraft] = useState<ResumeRevisionDraft | null>(initialRevisionDraft ?? null)
  const [draftSaveState, setDraftSaveState] = useState<'saving' | 'saved' | 'error'>('saved')
  const [revisionBusy, setRevisionBusy] = useState(false)
  const [photoReading, setPhotoReading] = useState(false)
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
  const canUseOriginal = !!onLoadOriginal && /\.pdf$/i.test(sourceFile)
  const [original, setOriginal] = useState<File | undefined>()
  const [originalError, setOriginalError] = useState('')
  const [originalAttempt, setOriginalAttempt] = useState(0)
  const template = resumeTemplateId(revisionDraft?.template ?? (canUseOriginal ? 'original' : initialPdfTemplate))
  const sourcePhotos = useSourceResumePhotos(original, initialPhoto)
  const inheritedPhoto = initialPhoto ?? (sourcePhotos.photos.length === 1 ? sourcePhotos.photos[0] : undefined)
  const photo = template === 'original' ? inheritedPhoto : revisionDraft?.photo === undefined ? inheritedPhoto : revisionDraft.photo
  const photoUnresolved = template !== 'original' && (sourcePhotos.loading || ((!initialPhoto && (sourcePhotos.photos.length > 1 || !!sourcePhotos.error)) && revisionDraft?.photo === undefined))
  useEffect(() => {
    if (!onLoadOriginal) return
    let active = true
    setOriginalError('')
    void onLoadOriginal().then(file => { if (active) { setOriginal(file); if (!file) setOriginalError('原文件未找到，请重新上传简历。') } })
      .catch(() => { if (active) setOriginalError('原文件读取失败，请重新打开简历。') })
    return () => { active = false }
    // Load once for this opened document, rather than refetching on each edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFile, canUseOriginal, originalAttempt])
  const pdf = useResumePdf(editingText, sourceFile, !!editingText.trim() && (tab !== 'structure' || revisionDraft !== null) && (!onLoadOriginal || !!original), template, original, text, template === 'original' ? photo : photo ?? null)
  const paragraphSections = useMemo(() => tailoringSections(editingText), [editingText])
  const paragraphRanges = useMemo(() => tailoringSourceRanges(editingText, paragraphSections), [editingText, paragraphSections])
  const originalParagraphs = useMemo(() => {
    const base = tailoringSections(text)
    // Only offer per-line undo when the same sections and line positions still exist.
    if (base.length !== paragraphSections.length || base.some((section, index) => section.title !== paragraphSections[index].title || section.lines.length !== paragraphSections[index].lines.length)) return undefined
    return Object.fromEntries(base.flatMap(section => section.lines.map((line, index) => [`${section.id}:${index}`, line])))
  }, [text, paragraphSections])
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
  const groupedCandidates = useMemo(() => groupCandidates(candidates, sections), [candidates, sections])
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
    const draft = value === text && revisionDraft?.template === undefined && sameResumePhoto(photo, initialPhoto) ? null : { baseText: text, text: value, template, photo }
    setRevisionDraft(draft)
    setRevisionError(null)
    void persistRevisionDraft(draft)
  }
  const changeTemplate = (value: ResumeTemplateId) => {
    if (analyzing || revisionAction.current || leaving || revisionConflict) return
    diagnosis.cancel()
    const draft = { baseText: text, text: editingText, template: value, photo: value === 'original' ? inheritedPhoto : photo }
    setRevisionDraft(draft); setRevisionError(null)
    void persistRevisionDraft(draft)
  }
  const changeParagraph = (key: string, replacement: string) => {
    const range = paragraphRanges.get(key)
    if (range) updateText(editingText.slice(0, range.start) + replacement + editingText.slice(range.end))
  }
  const changePhoto = (value: ResumePhoto | null) => {
    if (analyzing || revisionAction.current || leaving || revisionConflict) return
    const draft = { baseText: text, text: editingText, template, photo: value }
    setRevisionDraft(draft); setRevisionError(null)
    void persistRevisionDraft(draft)
  }
  const resetParagraph = (key: string) => { const value = originalParagraphs?.[key]; if (value !== undefined) changeParagraph(key, value) }

  const saveRevision = async () => {
    if (!revisionDraft || revisionConflict || revisionAction.current || analyzing || photoReading || photoUnresolved) return
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

  const addCandidate = (title: string, lineNumber: number) => {
    if (workflowBlocked) return
    const section = sections.find(section => section.title === title)
    if (section) setCandidates(current => includeReviewLine(current, section, lineNumber))
  }
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
      openSettings('model')
      return
    }
    diagnosis.cancel()
    onConfirm(review, sourceFile)
  }

  return {
    text, sections, candidates, setCandidates, tab, setTab, writingMode, setWritingMode,
    editingParagraph, setEditingParagraph, analysisGoal, setAnalysisGoal, jobDescription, setJobDescription,
    openSettings, openNav, sidebarOpen, setSidebarOpen, editingId, setEditingId, goalOpen, setGoalOpen,
    jdOpen, setJdOpen, lastDeleted, setLastDeleted, revisionDraft, setRevisionDraft, draftSaveState,
    revisionBusy, photoReading, setPhotoReading, revisionError, previewOpen, setPreviewOpen,
    mobileDocument, setMobileDocument, editRequest, setEditRequest, leaving, downloading, editingText,
    canUseOriginal, original, setOriginal, originalError, setOriginalError, originalAttempt, setOriginalAttempt,
    template, sourcePhotos, inheritedPhoto, photo, photoUnresolved, pdf, paragraphSections, paragraphRanges,
    originalParagraphs, revisionPending, revisionConflict, workflowBlocked, diagnosis, selectedCandidates,
    review, saveState, setSaveState, groupedCandidates, projectSectionTitles, persistRevisionDraft,
    updateText, changeTemplate, changeParagraph, changePhoto, resetParagraph, saveRevision, discardRevision,
    leaveReview, downloadResume, updateCandidate, deleteCandidate, undoDelete, selectAll, clearAll,
    keepProjects, scrollToSection, mergeWithNext, addCandidate, submit,
  }
}