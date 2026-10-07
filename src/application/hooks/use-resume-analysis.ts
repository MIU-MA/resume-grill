'use client'

import { useCallback, useState } from 'react'
import { deleteResumeDocument, importResumeDocument, listResumeDocuments, loadResumeDocument, resumeDocumentForRecord, saveResumeRevisionDraft, setCurrentResumeDocument, updateResumeDocument, type ResumeDocument, type ResumeRevisionDraft } from '@/features/resume/lib/resume-library'
import { createResumeRevision, downloadResumeFile } from '@/features/resume/lib/resume-revision'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import type { AnalysisGoal, ReviewedCandidate } from '@/domain/analysis-config'
import { reviewedCandidatesKey } from '@/domain/analysis-config'
import type { ExtractedText } from '@/features/resume/lib/pdf'
import { extractResumeClaimCandidates } from '@/domain/resume-structure'
import type { LlmSettings } from '@/lib/settings'
import { getLlmSettings } from '@/lib/settings'
import { prepareJobResume } from '@/features/resume/lib/job-preparation'
import type { JobPreparationRequest } from '@/domain/job-preparation'
import type { JobPreparationIntent } from '@/domain/job-preparation'
import {
  deleteRecord,
  listRecords,
  loadRecord,
  newRecordId,
  saveRecord,
  updateRecordDiagnosis,
  type SavedRecord,
} from '@/lib/storage'
import type { AppNavigation, UseResumeWorkspace } from '@/application/types'
import type { ResumeReviewSubmission } from '@/domain/resume-review'

export function useResumeAnalysis(
  ws: UseResumeWorkspace,
  navigation: AppNavigation,
) {
  const { push } = navigation
  const [analyzing, setAnalyzing] = useState(false)

  const openSavedRecord = useCallback(
    (record: SavedRecord, linkedDocument?: ResumeDocument) => {
      const document = linkedDocument ?? ws.savedDocuments.find(item => item.recordId === record.id)
      const review = document?.review
      const savedAnalysis = review && review.rawText === record.analysis.rawText && review.jobDescription === (record.analysis.jobDescription ?? '')
        ? { ...record.analysis, diagnosis: review.diagnosis }
        : record.analysis
      ws.setAnalysis(savedAnalysis)
      ws.setSessions(record.sessions)
      ws.setPreparedClaimIds(record.preparedClaimIds)
      ws.setMasteredBlindSpotIds(record.masteredBlindSpotIds)
      ws.setClaimPriorityOverrides(record.claimPriorityOverrides ?? {})
      ws.setRecordId(record.id)
      ws.setSelectedIndex(0)
      ws.setPendingExtracted(null)
      ws.setError(null)
      window.sessionStorage.setItem('resume-grill:active', record.id)
      const pending = ws.pendingExtracted
      const pendingMatches = pending?.initialReview && newRecordId({ ...pending.initialReview, jobContext: pending.jobContext, revisionId: pending.revisionId }) === newRecordId(record.analysis)
      void setCurrentResumeDocument(document?.id ?? (pendingMatches ? pending.documentId : undefined) ?? record.analysis.jobContext?.resumeDocumentId ?? null).catch(() => undefined)
      push('workspace', 'audit')
    },
    [ws, push],
  )

  const openResumeDocument = useCallback((document: ResumeDocument, autoDiagnose = false, preparationIntent: JobPreparationIntent = 'diagnosis') => {
    ws.setAnalysis(null)
    ws.setRecordId(document.recordId ?? null)
    ws.setPendingExtracted({ extracted: document.extracted, sourceFile: document.sourceFile, demo: document.demo, documentId: document.id, initialReview: document.review, autoDiagnose, jobContext: document.jobContext, preparationIntent, revisionId: document.revisionId, revisionDraft: document.revisionDraft, hasAttachment: Boolean(document.originalFile) })
    ws.setError(null)
    window.sessionStorage.setItem('resume-grill:review-document', document.id)
    window.sessionStorage.setItem('resume-grill:review-intent', preparationIntent)
    void setCurrentResumeDocument(document.id).catch(() => undefined)
    push('review')
  }, [ws, push])

  const handleExtracted = useCallback(
    async (extracted: ExtractedText, sourceFile: string, demo = false, originalFile?: File) => {
      ws.setError(null)
      let document: ResumeDocument
      try {
        document = await importResumeDocument(extracted, sourceFile, demo, originalFile)
      } catch {
        ws.setAnalysis(null)
        ws.setRecordId(null)
        ws.setPendingExtracted({ extracted, sourceFile, demo })
        ws.setError('简历未能保存到本地。可以继续检查，请导出结果备份。')
        push('review')
        return
      }
      let linkFailed = false
      try {
        if (!document.recordId && !demo) {
          const existing = (await listRecords()).find(record => !record.analysis.jobContext && !record.analysis.revisionId && record.analysis.rawText === extracted.text.trim())
          if (existing) {
            const review = document.review ?? { rawText: existing.analysis.rawText, analysisGoal: existing.analysis.analysisGoal ?? 'overall', reviewedCandidates: existing.analysis.reviewedCandidates ?? extractResumeClaimCandidates(existing.analysis.rawText), jobDescription: existing.analysis.jobDescription ?? '', diagnosis: existing.analysis.diagnosis }
            await updateResumeDocument(document.id, { recordId: existing.id, review })
            document = { ...document, recordId: existing.id, review }
          }
        }
      } catch { linkFailed = true }
      openResumeDocument(document, !document.review?.diagnosis)
      if (linkFailed) ws.setError('简历已保存，暂时无法读取旧练习记录。可以继续检查。')
    },
    [ws, push, openResumeDocument],
  )

  const saveReview = useCallback(async (review: ResumeReviewSubmission) => {
    const id = ws.pendingExtracted?.documentId
    if (!id) throw new Error('简历未能保存到本地，请重新导入或导出结果备份。')
    await updateResumeDocument(id, { review })
    if (ws.recordId) await updateRecordDiagnosis(ws.recordId, review)
    ws.setPendingExtracted(current => current?.documentId === id ? { ...current, initialReview: review, autoDiagnose: false } : current)
  }, [ws])

  const saveRevisionDraft = useCallback(async (draft: ResumeRevisionDraft | null) => {
    const id = ws.pendingExtracted?.documentId
    if (!id) throw new Error('原简历未保存，请先重新导入。')
    await saveResumeRevisionDraft(id, draft)
    ws.setPendingExtracted(current => current?.documentId === id ? { ...current, revisionDraft: draft ?? undefined } : current)
  }, [ws])

  const saveRevision = useCallback(async (text: string) => {
    const pending = ws.pendingExtracted
    if (!pending?.documentId) throw new Error('原简历未保存，请先重新导入。')
    const document = await createResumeRevision(pending.documentId, text, pending.initialReview?.rawText ?? pending.extracted.text)
    openResumeDocument(document, false)
    try { downloadResumeFile(document.originalFile!) } catch { ws.setError('新稿已保存，可点击“下载简历”重试下载。') }
  }, [ws, openResumeDocument])

  const downloadResume = useCallback(async () => {
    const id = ws.pendingExtracted?.documentId
    const document = id ? await loadResumeDocument(id) : undefined
    if (!document?.originalFile) throw new Error('这份简历没有可下载的附件，请修改后保存为新稿。')
    downloadResumeFile(document.originalFile)
  }, [ws.pendingExtracted?.documentId])

  const editActiveResume = useCallback(async () => {
    if (!ws.recordId) return
    try {
      const record = await loadRecord(ws.recordId)
      if (!record) throw new Error('当前练习记录已不存在，请从简历库重新打开。')
      const document = await resumeDocumentForRecord(record)
      openResumeDocument(document, false)
    } catch (error) { ws.setError(error instanceof Error ? error.message : '无法打开简历。') }
  }, [ws, openResumeDocument])

  const removeResumeDocument = useCallback(async (id: string) => {
    await deleteResumeDocument(id)
    ws.setSavedDocuments(documents => documents.filter(document => document.id !== id))
    if (window.sessionStorage.getItem('resume-grill:review-document') === id) window.sessionStorage.removeItem('resume-grill:review-document')
  }, [ws])

  const handleConfirmText = useCallback(
    async (submission: ResumeReviewSubmission, sourceFile: string, document?: ResumeDocument) => {
      const pending = document ? { documentId: document.id, demo: document.demo, jobContext: document.jobContext, revisionId: document.revisionId } : ws.pendingExtracted
      const { rawText, analysisGoal, reviewedCandidates, jobDescription } =
        submission
      if (!rawText.trim()) {
        ws.setError('未检测到有效的简历正文，请尝试粘贴文本。')
        return
      }
      setAnalyzing(true)
      ws.setError(null)
      try {
        const identity = newRecordId({ ...submission, jobContext: pending?.jobContext, revisionId: pending?.revisionId })
        const linkedId = document?.recordId ?? (document ? null : ws.recordId)
        const linked = linkedId ? await loadRecord(linkedId) : undefined
        const existing = linked && newRecordId(linked.analysis) === identity
          ? linked
          : (await listRecords()).find(record => newRecordId(record.analysis) === identity)
        const existingCandidates =
          existing?.analysis.reviewedCandidates ??
          (existing
            ? extractResumeClaimCandidates(existing.analysis.rawText)
            : [])
        const sameReview =
          existing &&
          (existing.analysis.analysisGoal ?? 'overall') === analysisGoal &&
          (existing.analysis.jobDescription ?? '') === jobDescription &&
          reviewedCandidatesKey(existingCandidates) ===
            reviewedCandidatesKey(reviewedCandidates)

        if (
          !pending?.demo &&
          existing &&
          existing.analysis.rawText === rawText &&
          sameReview
        ) {
          const restored = submission.diagnosis
            ? { ...existing, analysis: { ...existing.analysis, diagnosis: submission.diagnosis }, updatedAt: Date.now() }
            : existing
          if (pending?.documentId) await updateResumeDocument(pending.documentId, { recordId: restored.id, review: submission })
          openSavedRecord(restored, document)
          if (submission.diagnosis) saveRecord(restored).catch(() => ws.showToast('检查结果未能保存，请先导出备份。'))
          ws.showToast(
            `已打开「${existing.analysis.candidate}」的练习记录。`,
          )
          return
        }

        const llm = getLlmSettings()
        const body: {
          rawText: string
          sourceFile: string
          analysisGoal: AnalysisGoal
          reviewedCandidates: ReviewedCandidate[]
          jobDescription: string
          demo?: boolean
          llm?: LlmSettings
        } = {
          rawText,
          sourceFile,
          analysisGoal,
          reviewedCandidates,
          jobDescription,
          demo: pending?.demo ?? false,
        }
        if (llm && !body.demo) body.llm = llm

        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const responseData = (await res.json()) as ResumeAnalysis | { error: string }
        if (!res.ok || 'error' in responseData) {
          throw new Error('error' in responseData ? responseData.error : '分析失败')
        }
        const data: ResumeAnalysis = { ...responseData, jobContext: pending?.jobContext, revisionId: pending?.revisionId, diagnosis: submission.diagnosis }

        const retainedSessions = existing
          ? Object.fromEntries(
              data.claims.flatMap((claim) =>
                existing.sessions[claim.id]
                  ? [[claim.id, existing.sessions[claim.id]] as const]
                  : [],
              ),
            )
          : {}
        const retainedPrepared = existing
          ? existing.preparedClaimIds.filter((id) =>
              data.claims.some((c) => c.id === id),
            )
          : []
        const retainedMasteredBlindSpots =
          existing?.masteredBlindSpotIds ?? []
        const retainedPriorityOverrides = Object.fromEntries(
          Object.entries(existing?.claimPriorityOverrides ?? {}).filter(([id]) => data.claims.some((claim) => claim.id === id)),
        )

        const id = existing?.id ?? newRecordId(data)
        if (pending?.documentId) {
          await updateResumeDocument(pending.documentId, { recordId: id, review: submission })
        }
        ws.setAnalysis(data)
        ws.setSelectedIndex(0)
        ws.setSessions(retainedSessions)
        ws.setPreparedClaimIds(retainedPrepared)
        ws.setMasteredBlindSpotIds(retainedMasteredBlindSpots)
        ws.setClaimPriorityOverrides(retainedPriorityOverrides)
        push('workspace', 'audit')

        ws.setRecordId(id)
        window.sessionStorage.setItem('resume-grill:active', id)
        saveRecord({
          id,
          analysis: data,
          sessions: retainedSessions,
          preparedClaimIds: retainedPrepared,
          masteredBlindSpotIds: retainedMasteredBlindSpots,
          claimPriorityOverrides: retainedPriorityOverrides,
          updatedAt: Date.now(),
        }).catch(() => ws.showToast('练习记录未能保存，请导出备份。'))
        ws.showToast(
          `已为「${data.candidate}」准备 ${data.claims.length} 条练习内容。`,
        )
      } catch (e) {
        ws.setError(e instanceof Error ? e.message : '分析失败')
      } finally {
        setAnalyzing(false)
      }
    },
    [ws, push, openSavedRecord],
  )

  const openJobPreparation = useCallback(async (request: JobPreparationRequest, intent: JobPreparationIntent, onOpen?: () => void) => {
    const document = await prepareJobResume(request)
    const previous = intent === 'interview' && document.recordId ? await loadRecord(document.recordId) : undefined
    onOpen?.()
    if (previous && document.review && newRecordId(previous.analysis) === newRecordId({ ...document.review, jobContext: document.jobContext, revisionId: document.revisionId })) {
      openSavedRecord(previous, document)
      return
    }
    openResumeDocument(document, intent === 'diagnosis' && !document.review?.diagnosis, intent)
    // This click explicitly requests a plan; opening/reloading a review never does.
    if (intent === 'interview' && document.review && (ws.envConfigured || ws.clientConfigured)) {
      await handleConfirmText(document.review, document.sourceFile, document)
    }
  }, [openResumeDocument, openSavedRecord, handleConfirmText, ws.envConfigured, ws.clientConfigured])

  const replaceResume = useCallback(() => {
    ws.setAnalysis(null)
    ws.setPendingExtracted(null)
    ws.setSessions({})
    ws.setPreparedClaimIds([])
    ws.setMasteredBlindSpotIds([])
    ws.setClaimPriorityOverrides({})
    ws.setRecordId(null)
    ws.setError(null)
    ws.setRecoveredFromStorage(false)
    window.sessionStorage.removeItem('resume-grill:active')
    window.sessionStorage.removeItem('resume-grill:active-claim')
    window.sessionStorage.removeItem('resume-grill:review-document')
    window.sessionStorage.removeItem('resume-grill:review-intent')
    push('upload')
  }, [ws, push])

  const removeSavedRecord = useCallback(
    async (id: string) => {
      await deleteRecord(id)
      const documents = await listResumeDocuments()
      await Promise.all(documents.filter(document => document.recordId === id).map(document => deleteResumeDocument(document.id)))
      ws.setSavedDocuments(current => current.filter(document => document.recordId !== id))
      ws.setSavedRecords((records) => records.filter((r) => r.id !== id))
      if (window.sessionStorage.getItem('resume-grill:active') === id) {
        window.sessionStorage.removeItem('resume-grill:active')
      }
    },
    [ws],
  )

  return {
    analyzing,
    openJobPreparation,
    handleExtracted,
    openResumeDocument,
    removeResumeDocument,
    saveReview,
    saveRevisionDraft,
    saveRevision,
    downloadResume,
    editActiveResume,
    handleConfirmText,
    replaceResume,
    openSavedRecord,
    removeSavedRecord,
  }
}
