'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ResumeAnalysis, ResumeClaim } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { computeStats } from '@/lib/risk'
import type { ExtractedText } from '@/lib/pdf'
import {
  listRecords,
  loadRecord,
  upsertSession,
  type SavedRecord,
} from '@/lib/storage'
import type { Phase } from '@/lib/use-app-navigation'
import { useLlmStatus } from '@/lib/use-llm-status'

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

  const workspaceRef = useRef({ recordId, analysis })
  workspaceRef.current = { recordId, analysis }

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
        upsertSession(rid, a, claimId, session).catch(() => undefined)
      }
    },
    [],
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
    activeClaimBase,
    handleSessionSaved,
  }
}
