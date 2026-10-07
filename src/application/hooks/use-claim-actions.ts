'use client'

import { useCallback, useRef } from 'react'
import type { ResumeClaim, TestPriority } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { downloadFullReport, downloadJsonExport } from '@/features/report/lib/report'
import { getInterviewEntry } from '@/domain/interview-entry'
import { getLlmSettings } from '@/lib/settings'
import { updatePreparedClaims, updateClaimPriorityOverrides } from '@/lib/storage'
import type { AppNavigation, UseResumeWorkspace } from '@/application/types'

type InterviewHandle = {
  reset: () => void
  start: (claim: ResumeClaim, opts?: { version?: number; claimContent?: string }) => Promise<void>
  restore: (claim: ResumeClaim, session: InterviewSession) => boolean
  activeClaimSnapshot: ResumeClaim | null
  currentQuestion: string
  done: boolean
  loading: boolean
}

export function useClaimActions(
  ws: UseResumeWorkspace,
  iv: InterviewHandle,
  navigation: AppNavigation,
) {
  const { replace } = navigation
  const startingRef = useRef(false)

  const togglePrepared = useCallback(
    (claimId: string) => {
      ws.setPreparedClaimIds((current) => {
        const next = current.includes(claimId)
          ? current.filter((id) => id !== claimId)
          : [...current, claimId]
        if (ws.recordId && ws.analysis) {
          updatePreparedClaims(ws.recordId, ws.analysis, next).catch(
            () => undefined,
          )
        }
        return next
      })
    },
    [ws],
  )

  const toggleBlindSpotMastered = useCallback(
    (blindSpotId: string) => {
      ws.setMasteredBlindSpotIds((current) => {
        const next = current.includes(blindSpotId)
          ? current.filter((id) => id !== blindSpotId)
          : [...current, blindSpotId]
        return next
      })
    },
    [ws],
  )

  /** 批量统一设置优先级，一次 diff + 一次持久化 */
  const setClaimsPriority = useCallback(
    (ids: string[], priority: TestPriority) => {
      ws.setClaimPriorityOverrides((current) => {
        const next = { ...current }
        for (const id of ids) {
          const original = ws.analysis?.claims.find(
            (claim) => claim.id === id,
          )?.testPriority
          if (original === priority) delete next[id]
          else next[id] = priority
        }
        if (ws.recordId && ws.analysis) {
          updateClaimPriorityOverrides(ws.recordId, ws.analysis, next).catch(
            () => undefined,
          )
        }
        return next
      })
    },
    [ws],
  )

  /** 批量标记为已准备（只增不删），一次持久化 */
  const togglePreparedMany = useCallback(
    (ids: string[]) => {
      ws.setPreparedClaimIds((current) => {
        const set = new Set(current)
        for (const id of ids) set.add(id)
        const next = [...set]
        if (ws.recordId && ws.analysis) {
          updatePreparedClaims(ws.recordId, ws.analysis, next).catch(
            () => undefined,
          )
        }
        return next
      })
    },
    [ws],
  )

  const selectClaim = useCallback(
    (index: number) => {
      if (index === ws.selectedIndex) return
      ws.setSelectedIndex(index)
      replace('workspace', 'audit')
      iv.reset()
    },
    [ws, replace, iv],
  )

  const startInterview = useCallback(async () => {
    if (!ws.selected || iv.loading || startingRef.current) return

    const entry = getInterviewEntry(ws.selected.id, ws.sessions[ws.selected.id] ?? [], iv)
    if (entry.action === 'continue') {
      replace('workspace', 'interview')
      return
    }
    if (entry.action === 'restore') {
      if (iv.restore(ws.selected, entry.session)) {
        ws.setError(null)
        replace('workspace', 'interview')
      }
      return
    }
    if (!ws.envConfigured && !getLlmSettings()) {
      ws.setError('开始练习前，请在右上角设置中配置模型。')
      return
    }

    startingRef.current = true
    try {
      iv.reset()
      await iv.start(ws.selected, { version: entry.version })
      replace('workspace', 'interview')
    } finally {
      startingRef.current = false
    }
  }, [ws, replace, iv])

  const startRewriteInterview = useCallback(
    (claim: ResumeClaim, rewrittenContent: string) => {
      const idx =
        ws.analysis?.claims.findIndex((c) => c.id === claim.id) ?? -1
      if (idx < 0) return
      ws.setSelectedIndex(idx)
      const prevCount = (ws.sessions[claim.id] ?? []).length
      const newVersion = prevCount + 1
      replace('workspace', 'interview')
      iv.start(claim, { version: newVersion, claimContent: rewrittenContent }).catch(() => undefined)
      window.scrollTo({ top: 0, left: 0 })
    },
    [ws, replace, iv],
  )

  const retestClaim = useCallback(
    (claim: ResumeClaim) => {
      const idx =
        ws.analysis?.claims.findIndex((c) => c.id === claim.id) ?? -1
      if (idx < 0) return
      ws.setSelectedIndex(idx)
      const newVersion = (ws.sessions[claim.id] ?? []).length + 1
      replace('workspace', 'interview')
      iv.start(claim, { version: newVersion }).catch(() => undefined)
      window.scrollTo({ top: 0, left: 0 })
    },
    [ws, replace, iv],
  )

  const goReport = useCallback(() => {
    replace('workspace', 'report')
    window.scrollTo({ top: 0, left: 0 })
  }, [replace])

  const exportFull = useCallback(() => {
    if (!ws.analysis) return
    downloadFullReport(ws.analysis, ws.sessions, ws.masteredBlindSpotIds)
  }, [ws.analysis, ws.sessions, ws.masteredBlindSpotIds])

  const exportJson = useCallback(() => {
    if (!ws.analysis) return
    downloadJsonExport(ws.analysis, ws.sessions, ws.masteredBlindSpotIds)
  }, [ws.analysis, ws.sessions, ws.masteredBlindSpotIds])

  return {
    togglePrepared,
    toggleBlindSpotMastered,
    setClaimsPriority,
    togglePreparedMany,
    selectClaim,
    startInterview,
    startRewriteInterview,
    retestClaim,
    goReport,
    exportFull,
    exportJson,
  }
}
