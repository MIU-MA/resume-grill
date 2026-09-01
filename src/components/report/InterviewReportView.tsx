'use client'

import { useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  Target,
} from 'lucide-react'
import {
  type ResumeAnalysis,
  type ResumeClaim,
  type TestPriority,
} from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { Button } from '@/components/ui/Button'
import { deriveTopActions } from '@/lib/report-actions'
import { ClaimReportDetail } from '@/components/report/ClaimReportDetail'
import { ReportOverview } from '@/components/report/ReportOverview'
import { ReportJobMatch } from '@/components/report/ReportJobMatch'
import { ReportBlindSpots } from '@/components/report/ReportBlindSpots'
import { ReportClaimList } from '@/components/report/ReportClaimList'
import type { ClaimReport } from '@/components/report/report-types'

type InterviewReportViewProps = {
  analysis: ResumeAnalysis
  sessions: Record<string, InterviewSession[]>
  claimPriorityOverrides: Record<string, TestPriority>
  masteredBlindSpotIds: string[]
  onToggleBlindSpot: (blindSpotId: string) => void
  onRetest: (claim: ResumeClaim) => void
  onRewrite: (claim: ResumeClaim, rewrittenContent: string) => void
  onRegenerateSummary: (claim: ResumeClaim, session: InterviewSession) => void
  regeneratingId: string | null
}

export function InterviewReportView({
  analysis,
  sessions,
  claimPriorityOverrides,
  masteredBlindSpotIds,
  onToggleBlindSpot,
  onRetest,
  onRewrite,
  onRegenerateSummary,
  regeneratingId,
}: InterviewReportViewProps) {
  const reports = useMemo<ClaimReport[]>(
    () =>
      analysis.claims.map((claim) => {
        const list = (sessions[claim.id] ?? [])
          .slice()
          .sort((a, b) => a.version - b.version)
        const doneSessions = list.filter((s) => s.status === 'done')
        const latest = doneSessions[doneSessions.length - 1] ?? null
        const score = latest?.finalResult ? latest.finalResult.masteryScore : null
        const hasInProgress = list.some((s) => s.status === 'in_progress')
        return { claim, doneSessions, hasInProgress, latest, score }
      }),
    [analysis.claims, sessions],
  )

  const [activeClaimId, setActiveClaimId] = useState<string | null>(
    () =>
      (reports.find((r) => r.score !== null) ?? reports[0])?.claim.id ?? null,
  )
  const [versionOf, setVersionOf] = useState<Record<string, number>>({})
  const blindSpotRef = useRef<HTMLElement>(null)
  const topActions = useMemo(
    () =>
      deriveTopActions(
        analysis,
        sessions,
        masteredBlindSpotIds,
        3,
        claimPriorityOverrides,
      ),
    [analysis, sessions, masteredBlindSpotIds, claimPriorityOverrides],
  )

  const readyReports = reports.filter((r) => r.doneSessions.length > 0)
  const doneCount = readyReports.length
  const summarizing = reports.some((r) => {
    const latest = r.latest
    return latest != null && latest.finalResult == null && latest.summaryStatus === undefined
  })

  const avg05 = useMemo(() => {
    const scored = readyReports.map((r) => r.score).filter((s): s is number => s != null)
    return scored.length > 0
      ? scored.reduce((sum, s) => sum + s, 0) / scored.length
      : null
  }, [readyReports])
  const avgPct = avg05 != null ? Math.round((avg05 / 5) * 100) : 0

  const activeReport = reports.find((r) => r.claim.id === activeClaimId) ?? reports[0] ?? null
  const selectedSession = activeReport
    ? (activeReport.doneSessions.find((s) => s.version === versionOf[activeReport.claim.id]) ??
      activeReport.doneSessions[activeReport.doneSessions.length - 1] ??
      activeReport.latest)
    : null
  const result = selectedSession?.finalResult ?? null

  const prevSession = activeReport && selectedSession
    ? activeReport.doneSessions
        .filter((s) => s.version < selectedSession.version && s.finalResult)
        .at(-1)
    : null
  const delta =
    activeReport && selectedSession && result && prevSession?.finalResult
      ? result.masteryScore - prevSession.finalResult.masteryScore
      : null

  return (
    <div className="space-y-4 pb-8">
      <ReportOverview
        topActions={topActions}
        doneCount={doneCount}
        totalCount={analysis.claims.length}
        weakCount={reports.filter(
          (report) => report.score !== null && report.score <= 2,
        ).length}
        summarizing={summarizing}
        averageScore={avg05}
        averagePercent={avgPct}
        onAction={(action) => {
          const claim = action.claimId
            ? analysis.claims.find((item) => item.id === action.claimId)
            : null
          if (action.kind === 'untested-high' && claim) onRetest(claim)
          else if (action.kind === 'weak-claim' && claim) {
            setActiveClaimId(claim.id)
          } else {
            blindSpotRef.current?.scrollIntoView({ behavior: 'smooth' })
          }
        }}
      />

      {analysis.jobMatch && <ReportJobMatch jobMatch={analysis.jobMatch} />}

      <ReportBlindSpots
        analysis={analysis}
        sessions={sessions}
        masteredBlindSpotIds={masteredBlindSpotIds}
        sectionRef={blindSpotRef}
        onToggle={onToggleBlindSpot}
        onRetest={onRetest}
      />

      {/* 主从布局：左侧要点列表 + 右侧单条复盘 */}
      <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-4 items-start max-[980px]:grid-cols-1">
        <ReportClaimList
          reports={reports}
          activeClaimId={activeReport?.claim.id ?? null}
          doneCount={doneCount}
          onSelect={setActiveClaimId}
        />

        <article className="min-w-0 overflow-hidden rounded-lg border border-line bg-white shadow-card">
          {!activeReport || !selectedSession ? (
            <div className="grid place-items-center px-6 py-20 text-center">
              <div>
                <Target size={26} className="mx-auto mb-3 text-text-tertiary" />
                <p className="m-0 text-[14px] font-semibold text-text-primary">{activeReport?.hasInProgress ? '正在练习' : '这个要点还没练过'}</p>
                <p className="mt-2 text-[12px] text-text-tertiary">练完后，这里会显示本轮表现、回答记录和改写建议。</p>
                {activeReport && (
                  <Button variant="primary" className="mt-4" onClick={() => onRetest(activeReport.claim)}>
                    <ArrowRight size={14} />开始练习
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <ClaimReportDetail
              claim={activeReport!.claim}
              session={selectedSession}
              sessions={activeReport!.doneSessions}
              delta={delta}
              regeneratingId={regeneratingId}
              onVersionChange={(v) =>
                setVersionOf((cur) => ({ ...cur, [activeReport!.claim.id]: v }))
              }
              onRetest={() => onRetest(activeReport!.claim)}
              onRewrite={onRewrite}
              onRegenerateSummary={onRegenerateSummary}
            />
          )}
        </article>
      </div>
    </div>
  )
}
