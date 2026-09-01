'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import type { ResumeAnalysis, ResumeClaim, TestPriority } from '@/domain/resume-schema'
import type { InterviewAction, InterviewSession } from '@/domain/interview-schema'
import type { Mode } from '@/types'
import { ClaimAuditView } from '@/components/audit/ClaimAuditView'
import { InterviewView } from '@/components/interview/InterviewView'
import { InterviewStatusPanel } from '@/components/interview/InterviewStatusPanel'
import { InterviewReportView } from '@/components/report/InterviewReportView'
import { KnowledgeView } from '@/components/knowledge/KnowledgeView'
import type { KnowledgeItem, KnowledgeItemInput, KnowledgeItemPatch } from '@/lib/knowledge'
import type { ClaimProgress } from '@/lib/risk'

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

type AuditContent = {
  selectedIndex: number
  preparedClaimIds: string[]
  progressByClaim: Record<string, ClaimProgress>
  claimPriorityOverrides: Record<string, TestPriority>
  onSelect: (index: number) => void
  onTogglePrepared: (claimId: string) => void
  onSetClaimsPriority: (ids: string[], priority: TestPriority) => void
  onBatchTogglePrepared: (ids: string[]) => void
  onStartInterview: () => void
  onReport: () => void
}

type KnowledgeContent = {
  items: KnowledgeItem[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onRestore: (item: KnowledgeItem) => void
  onUpdate: (id: string, patch: KnowledgeItemPatch) => void
  onAdd: (input: KnowledgeItemInput) => void
  onRetest: (claim: ResumeClaim) => void
}

type ReportContent = {
  masteredBlindSpotIds: string[]
  onToggleBlindSpot: (blindSpotId: string) => void
  onRetest: (claim: ResumeClaim) => void
  onRewrite: (claim: ResumeClaim, rewrittenContent: string) => void
  onRegenerateSummary: (claim: ResumeClaim, session: InterviewSession) => void
}

type InterviewContent = {
  selected: ResumeClaim
  activeClaim: ResumeClaim
  view: InterviewViewData
  onFinish: () => void
  onBackToAudit: () => void
}

type WorkspaceContentProps = {
  mode: Mode
  analysis: ResumeAnalysis
  sessions: Record<string, InterviewSession[]>
  error: string | null
  audit: AuditContent
  knowledge: KnowledgeContent
  report: ReportContent
  interview: InterviewContent
}

export function WorkspaceContent({
  mode,
  analysis,
  sessions,
  error,
  audit,
  knowledge,
  report,
  interview,
}: WorkspaceContentProps) {
  const [strictMode, setStrictMode] = useState(true)
  const [statusOpen, setStatusOpen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width:1200px)').matches)

  if (mode === 'report') {
    return (
      <div className="h-full overflow-y-auto px-4 pb-12 pt-6 md:px-6">
        <div className="mx-auto max-w-[1392px]">
          <InterviewReportView
            analysis={analysis}
            sessions={sessions}
            claimPriorityOverrides={audit.claimPriorityOverrides}
            masteredBlindSpotIds={report.masteredBlindSpotIds}
            onToggleBlindSpot={report.onToggleBlindSpot}
            onRetest={report.onRetest}
            onRewrite={report.onRewrite}
            onRegenerateSummary={report.onRegenerateSummary}
            regeneratingId={interview.view.regeneratingId}
          />
        </div>
      </div>
    )
  }

  if (mode === 'audit') {
    return (
      <div className="h-full min-h-0 max-[760px]:overflow-y-auto">
        <ClaimAuditView
          analysis={analysis}
          selectedIndex={audit.selectedIndex}
          preparedClaimIds={audit.preparedClaimIds}
          sessions={sessions}
          error={error}
          onSelect={audit.onSelect}
          onTogglePrepared={audit.onTogglePrepared}
          onStartInterview={audit.onStartInterview}
          onReport={audit.onReport}
          progressByClaim={audit.progressByClaim}
          claimPriorityOverrides={audit.claimPriorityOverrides}
          onSetClaimsPriority={audit.onSetClaimsPriority}
          onBatchTogglePrepared={audit.onBatchTogglePrepared}
        />
      </div>
    )
  }

  if (mode === 'knowledge') {
    return (
      <div className="h-full overflow-y-auto px-4 pb-12 pt-6 md:px-6">
        <div className="mx-auto max-w-[1392px]">
          <KnowledgeView
            analysis={analysis}
            knowledgeItems={knowledge.items}
            onToggle={knowledge.onToggle}
            onDelete={knowledge.onDelete}
            onRestore={knowledge.onRestore}
            onUpdate={knowledge.onUpdate}
            onAdd={knowledge.onAdd}
            onRetest={knowledge.onRetest}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 border border-line rounded-lg overflow-hidden">
      {statusOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 min-[1200px]:hidden" onClick={() => setStatusOpen(false)} aria-hidden="true" />
      )}
      <InterviewView
        selected={interview.activeClaim}
        turns={interview.view.rounds.map((r) => ({
          action: r.action,
          question: r.question,
          answer: r.answer,
          annotation: r.annotation,
          answerSuggestion: r.evaluation.answerSuggestion,
          intent: r.questionIntent,
          evidenceQuotes: r.evaluation.evidenceQuotes,
        }))}
        currentQuestion={interview.view.currentQuestion || null}
        currentIntent={interview.view.currentIntent || null}
        covered={interview.view.covered}
        answer={interview.view.answer}
        loading={interview.view.loading}
        done={interview.view.done}
        annotation={interview.view.annotation}
        version={interview.view.version}
        error={error}
        strictMode={strictMode}
        onToggleStrict={() => setStrictMode((v) => !v)}
        statusOpen={statusOpen}
        onToggleStatus={() => setStatusOpen((v) => !v)}
        onAnswerChange={interview.view.setAnswer}
        onSubmit={() => interview.view.submit(interview.selected)}
        onSkip={() => interview.view.skip(interview.selected)}
        onAnnotationChange={interview.view.setAnnotation}
        onFinish={interview.onFinish}
        onBackToAudit={interview.onBackToAudit}
      />
      <InterviewStatusPanel
        selected={interview.activeClaim}
        roundCount={interview.view.rounds.filter((r) => r.answer.trim().length > 0).length}
        covered={interview.view.covered}
        strictMode={strictMode}
        statusOpen={statusOpen}
        onClose={() => setStatusOpen(false)}
      />
    </div>
  )
}
