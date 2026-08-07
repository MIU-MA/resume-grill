'use client'

import { useCallback } from 'react'
import type { ResumeClaim } from '@/domain/resume-schema'
import { downloadFullReport, downloadJsonExport } from '@/lib/report'
import { updateMasteredBlindSpots, updatePreparedClaims } from '@/lib/storage'
import type { AppNavigation, UseResumeWorkspace } from '@/lib/types'

type InterviewHandle = {
  reset: () => void
  start: (claim: ResumeClaim, opts?: { version?: number; claimContent?: string }) => Promise<void>
}

export function useClaimActions(
  ws: UseResumeWorkspace,
  iv: InterviewHandle,
  navigation: AppNavigation,
) {
  const { replace } = navigation

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
        if (ws.recordId && ws.analysis) {
          updateMasteredBlindSpots(ws.recordId, ws.analysis, next).catch(
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
      ws.setSelectedIndex(index)
      replace('workspace', 'audit')
      iv.reset()
    },
    [ws, replace, iv],
  )

  const startInterview = useCallback(async () => {
    if (!ws.selected) return

    const existingSessions = ws.sessions[ws.selected.id] ?? []

    const newVersion =
      existingSessions.reduce(
        (maxVersion, session) =>
          Math.max(maxVersion, session.version),
        0,
      ) + 1

    iv.reset()
    replace('workspace', 'interview')

    await iv.start(ws.selected, {
      version: newVersion,
    })
  }, [ws.selected, ws.sessions, replace, iv])

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
    selectClaim,
    startInterview,
    startRewriteInterview,
    retestClaim,
    goReport,
    exportFull,
    exportJson,
  }
}
