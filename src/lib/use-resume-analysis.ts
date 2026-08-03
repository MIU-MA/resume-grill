'use client'

import { useCallback, useState } from 'react'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import type { AnalysisGoal, ReviewedCandidate } from '@/domain/analysis-config'
import { reviewedCandidatesKey } from '@/domain/analysis-config'
import type { ExtractedText } from '@/lib/pdf'
import { extractResumeClaimCandidates } from '@/lib/resume-structure'
import type { LlmSettings } from '@/lib/settings'
import { getLlmSettings } from '@/lib/settings'
import {
  deleteRecord,
  listRecords,
  loadRecord,
  newRecordId,
  resumeContentKey,
  saveRecord,
  type SavedRecord,
} from '@/lib/storage'
import type { ResumeReviewSubmission } from '@/components/ExtractedTextReview'
import type { AppNavigation, UseResumeWorkspace } from './types'

export function useResumeAnalysis(
  ws: UseResumeWorkspace,
  navigation: AppNavigation,
) {
  const { push } = navigation
  const [analyzing, setAnalyzing] = useState(false)

  // ── 打开已保存记录 ────────────────────────────────────────
  const openSavedRecord = useCallback(
    (record: SavedRecord) => {
      ws.setAnalysis(record.analysis)
      ws.setSessions(record.sessions)
      ws.setPreparedClaimIds(record.preparedClaimIds)
      ws.setMasteredBlindSpotIds(record.masteredBlindSpotIds)
      ws.setRecordId(record.id)
      ws.setSelectedIndex(0)
      ws.setPendingExtracted(null)
      ws.setError(null)
      window.sessionStorage.setItem('resume-drill:active', record.id)
      push('workspace', 'audit')
    },
    [ws, push],
  )

  // ── 文本提取完成 → 进入校对页 ──────────────────────────────
  const handleExtracted = useCallback(
    (extracted: ExtractedText, sourceFile: string) => {
      ws.setPendingExtracted({ extracted, sourceFile })
      ws.setError(null)
      push('review')
    },
    [ws, push],
  )

  // ── 校对确认 → 发起分析 ────────────────────────────────────
  const handleConfirmText = useCallback(
    async (submission: ResumeReviewSubmission, sourceFile: string) => {
      const { rawText, analysisGoal, reviewedCandidates, jobDescription } =
        submission
      if (!rawText.trim()) {
        ws.setError('未检测到有效的简历正文，请尝试粘贴文本。')
        return
      }
      setAnalyzing(true)
      ws.setError(null)
      try {
        // 重复简历检测
        const records = ws.recordId ? [] : await listRecords()
        const existing = ws.recordId
          ? await loadRecord(ws.recordId)
          : records.find(
              (r) =>
                resumeContentKey(r.analysis.rawText) ===
                resumeContentKey(rawText),
            ) ?? records.find((r) => r.analysis.sourceFile === sourceFile)
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
          !ws.recordId &&
          existing &&
          existing.analysis.rawText === rawText &&
          sameReview
        ) {
          openSavedRecord(existing)
          ws.showToast(
            `已恢复「${existing.analysis.candidate}」的本地分析记录。`,
          )
          return
        }

        // 发起分析请求
        const llm = getLlmSettings()
        const body: {
          rawText: string
          sourceFile: string
          analysisGoal: AnalysisGoal
          reviewedCandidates: ReviewedCandidate[]
          jobDescription: string
          llm?: LlmSettings
        } = { rawText, sourceFile, analysisGoal, reviewedCandidates, jobDescription }
        if (llm) body.llm = llm

        const res = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = (await res.json()) as ResumeAnalysis | { error: string }
        if (!res.ok || 'error' in data) {
          throw new Error('error' in data ? data.error : '分析失败')
        }

        // 保留旧有会话和状态
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

        // 更新状态
        ws.setAnalysis(data)
        ws.setSelectedIndex(0)
        ws.setSessions(retainedSessions)
        ws.setPreparedClaimIds(retainedPrepared)
        ws.setMasteredBlindSpotIds(retainedMasteredBlindSpots)
        push('workspace', 'audit')

        const id = ws.recordId ?? existing?.id ?? newRecordId(data)
        ws.setRecordId(id)
        window.sessionStorage.setItem('resume-drill:active', id)
        saveRecord({
          id,
          analysis: data,
          sessions: retainedSessions,
          preparedClaimIds: retainedPrepared,
          masteredBlindSpotIds: retainedMasteredBlindSpots,
          updatedAt: Date.now(),
        }).catch(() => undefined)
        ws.showToast(
          `已载入「${data.candidate}」的简历，识别到 ${data.claims.length} 条声明。`,
        )
      } catch (e) {
        ws.setError(e instanceof Error ? e.message : '分析失败')
      } finally {
        setAnalyzing(false)
      }
    },
    [ws, push, openSavedRecord],
  )

  // ── 重置 → 返回上传页 ──────────────────────────────────────
  const replaceResume = useCallback(() => {
    ws.setAnalysis(null)
    ws.setPendingExtracted(null)
    ws.setSessions({})
    ws.setPreparedClaimIds([])
    ws.setMasteredBlindSpotIds([])
    ws.setRecordId(null)
    ws.setError(null)
    window.sessionStorage.removeItem('resume-drill:active')
    push('upload')
  }, [ws, push])

  // ── 删除历史记录 ──────────────────────────────────────────
  const removeSavedRecord = useCallback(
    async (id: string) => {
      await deleteRecord(id)
      ws.setSavedRecords((records) => records.filter((r) => r.id !== id))
      if (window.sessionStorage.getItem('resume-drill:active') === id) {
        window.sessionStorage.removeItem('resume-drill:active')
      }
    },
    [ws],
  )

  return {
    analyzing,
    handleExtracted,
    handleConfirmText,
    replaceResume,
    openSavedRecord,
    removeSavedRecord,
  }
}
