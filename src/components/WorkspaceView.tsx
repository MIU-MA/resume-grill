'use client'

import type { ResumeAnalysis, ResumeClaim } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import type { Mode } from '@/types'
import { AuditView } from '@/components/AuditView'
import { InterviewView } from '@/components/InterviewView'
import { InterviewStatus } from '@/components/InterviewStatus'
import { SessionReport } from '@/components/SessionReport'

// ── useInterview 视图层需要的数据 ──────────────────────────
export type InterviewViewData = {
  rounds: Array<{
    question: string
    answer: string
    annotation?: string
    evaluation: { answerSuggestion?: string }
  }>
  currentQuestion: string
  currentIntent: string
  covered: string[]
  answer: string
  loading: boolean
  done: boolean
  annotation: string
  version: number
  rewriteContent: string | null
  setAnswer: (v: string) => void
  setAnnotation: (v: string) => void
  submit: (claim: ResumeClaim) => Promise<void>
  reset: () => void
}

type WorkspaceViewProps = {
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
  onFinish: () => void
  onBackToAudit: () => void
}

export function WorkspaceView({
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
  onFinish,
  onBackToAudit,
}: WorkspaceViewProps) {
  if (mode === 'report') {
    return (
      <SessionReport
        analysis={analysis}
        sessions={sessions}
        masteredBlindSpotIds={masteredBlindSpotIds}
        onToggleBlindSpot={onToggleBlindSpot}
        onRetest={onRetest}
        onRewrite={onRewrite}
      />
    )
  }

  if (mode === 'audit') {
    return (
      <AuditView
        analysis={analysis}
        selectedIndex={selectedIndex}
        preparedClaimIds={preparedClaimIds}
        error={error}
        onSelect={onSelect}
        onTogglePrepared={onTogglePrepared}
        onStartInterview={onStartInterview}
        onReport={onReport}
      />
    )
  }

  return (
    <div className="flex">
      <InterviewView
        selected={activeClaim}
        turns={iv.rounds.map((r) => ({
          question: r.question,
          answer: r.answer,
          annotation: r.annotation,
          answerSuggestion: r.evaluation.answerSuggestion,
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
        onAnnotationChange={iv.setAnnotation}
        onFinish={onFinish}
        onBackToAudit={onBackToAudit}
      />
      <InterviewStatus
        selected={activeClaim}
        roundCount={iv.rounds.filter((r) => r.answer.trim().length > 0).length}
        covered={iv.covered}
      />
    </div>
  )
}
