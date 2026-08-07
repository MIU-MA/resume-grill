'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { ResumeAnalysis, ResumeClaim } from '@/domain/resume-schema'
import type { InterviewAction, InterviewSession } from '@/domain/interview-schema'
import type { Mode } from '@/types'
import { ClaimAuditView } from '@/components/audit/ClaimAuditView'
import { InterviewView } from '@/components/interview/InterviewView'
import { InterviewStatusPanel } from '@/components/interview/InterviewStatusPanel'
import { InterviewReportView } from '@/components/report/InterviewReportView'

export type InterviewViewData = {
  rounds: Array<{
    action: InterviewAction
    question: string
    questionIntent?: string
    answer: string
    annotation?: string
    evaluation: { answerSuggestion?: string; evidenceQuotes?: string[] }
    nextReason?: string
  }>
  currentQuestion: string
  currentIntent: string
  covered: string[]
  answer: string
  loading: boolean
  done: boolean
  annotation: string
  version: number
  activeClaimSnapshot: ResumeClaim | null
  setAnswer: Dispatch<SetStateAction<string>>
  setAnnotation: (v: string) => void
  submit: (claim: ResumeClaim) => Promise<void>
  skip: (claim: ResumeClaim) => Promise<void>
  reset: () => void
  regenerateSummary: (claim: ResumeClaim, session: InterviewSession) => Promise<boolean>
  regeneratingId: string | null
}

type WorkspaceContentProps = {
  mode: Mode
  analysis: ResumeAnalysis
  sessions: Record<string, InterviewSession[]>
  selectedIndex: number
  selected: ResumeClaim
  activeClaim: ResumeClaim
  preparedClaimIds: string[]
  masteredBlindSpotIds: string[]
  error: string | null
  iv: InterviewViewData
  onSelect: (index: number) => void
  onTogglePrepared: (claimId: string) => void
  onToggleBlindSpot: (blindSpotId: string) => void
  onStartInterview: () => void
  onReport: () => void
  onRetest: (claim: ResumeClaim) => void
  onRewrite: (claim: ResumeClaim, rewrittenContent: string) => void
  onRegenerateSummary: (claim: ResumeClaim, session: InterviewSession) => void
  onFinish: () => void
  onBackToAudit: () => void
}

export function WorkspaceContent({
  mode,
  analysis,
  sessions,
  selectedIndex,
  selected,
  activeClaim,
  preparedClaimIds,
  masteredBlindSpotIds,
  error,
  iv,
  onSelect,
  onTogglePrepared,
  onToggleBlindSpot,
  onStartInterview,
  onReport,
  onRetest,
  onRewrite,
  onRegenerateSummary,
  onFinish,
  onBackToAudit,
}: WorkspaceContentProps) {
  if (mode === 'report') {
    return (
      <InterviewReportView
        analysis={analysis}
        sessions={sessions}
        masteredBlindSpotIds={masteredBlindSpotIds}
        onToggleBlindSpot={onToggleBlindSpot}
        onRetest={onRetest}
        onRewrite={onRewrite}
        onRegenerateSummary={onRegenerateSummary}
        regeneratingId={iv.regeneratingId}
      />
    )
  }

  if (mode === 'audit') {
    const completedClaimIds = analysis.claims
      .filter((claim) => (sessions[claim.id] ?? []).some((s) => s.status === 'done'))
      .map((claim) => claim.id)
    return (
      <ClaimAuditView
        analysis={analysis}
        selectedIndex={selectedIndex}
        preparedClaimIds={preparedClaimIds}
        completedClaimIds={completedClaimIds}
        error={error}
        onSelect={onSelect}
        onTogglePrepared={onTogglePrepared}
        onStartInterview={onStartInterview}
        onReport={onReport}
      />
    )
  }

  return (
    <div className="flex border border-border rounded-lg overflow-hidden">
      <InterviewView
        selected={activeClaim}
        turns={iv.rounds.map((r) => ({
          action: r.action,
          question: r.question,
          answer: r.answer,
          annotation: r.annotation,
          answerSuggestion: r.evaluation.answerSuggestion,
          intent: r.questionIntent,
          evidenceQuotes: r.evaluation.evidenceQuotes,
        }))}
        currentQuestion={iv.currentQuestion || null}
        currentIntent={iv.currentIntent || null}
        covered={iv.covered}
        answer={iv.answer}
        loading={iv.loading}
        done={iv.done}
        annotation={iv.annotation}
        version={iv.version}
        error={error}
        onAnswerChange={iv.setAnswer}
        onSubmit={() => iv.submit(selected)}
        onSkip={() => iv.skip(selected)}
        onAnnotationChange={iv.setAnnotation}
        onFinish={onFinish}
        onBackToAudit={onBackToAudit}
      />
      <InterviewStatusPanel
        selected={activeClaim}
        roundCount={iv.rounds.filter((r) => r.answer.trim().length > 0).length}
        covered={iv.covered}
      />
    </div>
  )
}
