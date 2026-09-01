'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ResumeAnalysis, ResumeClaim, TestPriority } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { computeStats } from '@/lib/risk'
import type { ExtractedText } from '@/lib/pdf'
import {
  listRecords,
  loadRecord,
  upsertSession,
  loadKnowledgeItems,
  saveKnowledgeItems,
  loadDismissedKnowledgeItemIds,
  saveDismissedKnowledgeItemIds,
  updateMasteredBlindSpots,
  type SavedRecord,
} from '@/lib/storage'
import { deriveKnowledgeItems, mergeKnowledgeItems, filterDismissedKnowledgeItems, type KnowledgeItem } from '@/lib/knowledge'
import type { Phase } from '@/hooks/use-app-navigation'
import { useLlmStatus } from '@/hooks/use-llm-status'

export function useResumeWorkspace(phase: Phase) {
  const { envConfigured, clientConfigured, mode: llmMode, refresh: refreshClientLlm } =
    useLlmStatus()

  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null)
  const [pendingExtracted, setPendingExtracted] = useState<{
    extracted: ExtractedText
    sourceFile: string
    demo?: boolean
  } | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [sessions, setSessions] = useState<Record<string, InterviewSession[]>>({})
  const [preparedClaimIds, setPreparedClaimIds] = useState<string[]>([])
  const [masteredBlindSpotIds, setMasteredBlindSpotIds] = useState<string[]>([])
  const [claimPriorityOverrides, setClaimPriorityOverrides] = useState<Record<string, TestPriority>>({})
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([])
  const [dismissedKnowledgeItemIds, setDismissedKnowledgeItemIds] = useState<string[]>([])
  const [knowledgeHydrationStatus, setKnowledgeHydrationStatus] = useState<'pending' | 'hydrated' | 'error'>('pending')
  const [recordId, setRecordId] = useState<string | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [recoveredFromStorage, setRecoveredFromStorage] = useState(false)
  const [savedRecords, setSavedRecords] = useState<SavedRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [toast, setToast] = useState('')
  const [error, setError] = useState<string | null>(null)

  const showToast = useCallback((m: string, d = 3200) => {
    setToast(m)
    window.setTimeout(() => setToast(''), d)
  }, [])

  const refreshSavedRecords = useCallback(() => {
    setLoadingRecords(true)
    listRecords()
      .then(setSavedRecords)
      .catch(() => setSavedRecords([]))
      .finally(() => setLoadingRecords(false))
  }, [])

  const workspaceRef = useRef({ recordId, analysis })
  workspaceRef.current = { recordId, analysis }

  const reportStorageError = useCallback((action: string, e?: unknown) => {
    const message = e instanceof Error ? e.name || '未知错误' : '未知错误'
    console.error(`[resume-grill] ${action}失败 (${message})`, e instanceof Error ? { name: e.name, message: e.message } : e)
    showToast(`本地保存失败：${action}未成功，刷新后可能丢失`)
  }, [showToast])

  const handleSessionSaved = useCallback(
    (claimId: string, session: InterviewSession) => {
      setSessions((prev) => {
        const list = prev[claimId] ?? []
        const idx = list.findIndex((s) => s.version === session.version)
        return {
          ...prev,
          [claimId]:
            idx >= 0
              ? list.map((s, i) => (i === idx ? session : s))
              : [...list, session],
        }
      })
      const { recordId: rid, analysis: a } = workspaceRef.current
      if (rid && a) {
        upsertSession(rid, a, claimId, session).catch((e) =>
          reportStorageError('保存面试记录', e),
        )
      }
    },
    [reportStorageError],
  )

  const selected = analysis?.claims[selectedIndex] ?? null
  const stats = analysis ? computeStats(analysis.claims) : null
  const completedClaimCount = analysis
    ? analysis.claims.filter((c) =>
        (sessions[c.id] ?? []).some((s) => s.status === 'done'),
      ).length
    : 0

  useEffect(() => {
    if (phase !== 'workspace' || analysis) return
    const sid = window.sessionStorage.getItem('resume-grill:active')
    if (!sid) return
    setRecovering(true)
    loadRecord(sid)
      .then((record) => {
        if (record) {
          setAnalysis(record.analysis)
          setRecordId(record.id)
          setSessions(record.sessions)
          setPreparedClaimIds(record.preparedClaimIds)
          setMasteredBlindSpotIds(record.masteredBlindSpotIds)
          setClaimPriorityOverrides(record.claimPriorityOverrides ?? {})
          const activeClaimId = window.sessionStorage.getItem('resume-grill:active-claim')
          const index = activeClaimId
            ? record.analysis.claims.findIndex((c) => c.id === activeClaimId)
            : -1
          setSelectedIndex(index >= 0 ? index : 0)
          setRecoveredFromStorage(true)
        }
      })
      .catch(() => {})
      .finally(() => setRecovering(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (phase !== 'upload') return
    setLoadingRecords(true)
    listRecords()
      .then(setSavedRecords)
      .catch(() => setSavedRecords([]))
      .finally(() => setLoadingRecords(false))
  }, [phase])

  useEffect(() => {
    Promise.all([loadKnowledgeItems(), loadDismissedKnowledgeItemIds()])
      .then(([items, ids]) => {
        setKnowledgeItems(items)
        setDismissedKnowledgeItemIds(ids)
        setKnowledgeHydrationStatus('hydrated')
      })
      .catch((e) => {
        reportStorageError('加载本地知识点', e)
        setKnowledgeHydrationStatus('error')
      })
  }, [reportStorageError])

  useEffect(() => {
    if (!analysis || knowledgeHydrationStatus !== 'hydrated') return
    const derived = filterDismissedKnowledgeItems(
      deriveKnowledgeItems(analysis, sessions, masteredBlindSpotIds),
      dismissedKnowledgeItemIds,
    )
    setKnowledgeItems((current) => mergeKnowledgeItems(current, derived))
  }, [analysis, sessions, masteredBlindSpotIds, dismissedKnowledgeItemIds, knowledgeHydrationStatus])

  useEffect(() => {
    if (analysis && knowledgeHydrationStatus === 'hydrated') {
      saveKnowledgeItems(knowledgeItems).catch((e) => reportStorageError('保存本地知识点', e))
    }
  }, [knowledgeItems, analysis, knowledgeHydrationStatus, reportStorageError])

  useEffect(() => {
    if (knowledgeHydrationStatus === 'hydrated') {
      saveDismissedKnowledgeItemIds(dismissedKnowledgeItemIds).catch((e) => reportStorageError('保存忽略列表', e))
    }
  }, [dismissedKnowledgeItemIds, knowledgeHydrationStatus, reportStorageError])

  useEffect(() => {
    if (!recordId || !analysis) return
    updateMasteredBlindSpots(recordId, analysis, masteredBlindSpotIds).catch((e) =>
      reportStorageError('保存掌握状态', e),
    )
  }, [masteredBlindSpotIds, recordId, analysis, reportStorageError])

  const activeClaimBase = (rewriteContent: string | null): ResumeClaim => {
    if (!selected) throw new Error('no selected claim')
    return rewriteContent ? { ...selected, content: rewriteContent } : selected
  }

  return {
    envConfigured,
    clientConfigured,
    llmMode,
    refreshClientLlm,
    analysis,
    setAnalysis,
    pendingExtracted,
    setPendingExtracted,
    selectedIndex,
    setSelectedIndex,
    sessions,
    setSessions,
    preparedClaimIds,
    setPreparedClaimIds,
    masteredBlindSpotIds,
    setMasteredBlindSpotIds,
    knowledgeItems,
    setKnowledgeItems,
    dismissedKnowledgeItemIds,
    setDismissedKnowledgeItemIds,
    recordId,
    setRecordId,
    recovering,
    recoveredFromStorage,
    setRecoveredFromStorage,
    savedRecords,
    setSavedRecords,
    loadingRecords,
    toast,
    setToast,
    showToast,
    error,
    setError,
    selected,
    stats,
    completedClaimCount,
    claimPriorityOverrides,
    setClaimPriorityOverrides,
    refreshSavedRecords,
    activeClaimBase,
    handleSessionSaved,
  }
}
