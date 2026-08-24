'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import type { ResumeAnalysis, ResumeClaim } from '@/domain/resume-schema'
import type { InterviewAction, InterviewSession } from '@/domain/interview-schema'
import type { Mode } from '@/types'
import { ClaimAuditView } from '@/components/audit/ClaimAuditView'
import { InterviewView } from '@/components/interview/InterviewView'
import { InterviewStatusPanel } from '@/components/interview/InterviewStatusPanel'
import { InterviewReportView } from '@/components/report/InterviewReportView'
import { KnowledgeView } from '@/components/knowledge/KnowledgeView'
import type { KnowledgeItem, KnowledgeItemInput, KnowledgeItemPatch } from '@/lib/knowledge'

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
  knowledgeItems: KnowledgeItem[]
  onToggleKnowledgeItem: (id: string) => void
  onDeleteKnowledgeItem: (id: string) => void
  onRestoreKnowledgeItem: (item: KnowledgeItem) => void
  onUpdateKnowledgeItem: (id: string, patch: KnowledgeItemPatch) => void
  onAddKnowledgeItem: (input: KnowledgeItemInput) => void
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
  knowledgeItems,
  onToggleKnowledgeItem,
  onDeleteKnowledgeItem,
  onRestoreKnowledgeItem,
  onUpdateKnowledgeItem,
  onAddKnowledgeItem,
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
  const [strictMode, setStrictMode] = useState(true)
  // 窄屏下右侧考察面板以抽屉呈现
  const [statusOpen, setStatusOpen] = useState(false)

  if (mode === 'report') {
    return (
      <div className="h-full overflow-y-auto py-6 pb-12">
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
      </div>
    )
  }

  if (mode === 'audit') {
    return (
      <div className="h-full min-h-0 py-6 pb-12 max-[760px]:overflow-y-auto">
        <ClaimAuditView
          analysis={analysis}
          selectedIndex={selectedIndex}
          preparedClaimIds={preparedClaimIds}
          sessions={sessions}
          error={error}
          onSelect={onSelect}
          onTogglePrepared={onTogglePrepared}
          onStartInterview={onStartInterview}
          onReport={onReport}
        />
      </div>
    )
  }

  if (mode === 'knowledge') {
    return (
      <div className="h-full overflow-y-auto py-6 pb-12">
        <KnowledgeView
          analysis={analysis}
          knowledgeItems={knowledgeItems}
          onToggle={onToggleKnowledgeItem}
          onDelete={onDeleteKnowledgeItem}
          onRestore={onRestoreKnowledgeItem}
          onUpdate={onUpdateKnowledgeItem}
          onAdd={onAddKnowledgeItem}
          onRetest={onRetest}
        />
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 border border-line rounded-lg overflow-hidden">
      {statusOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setStatusOpen(false)} aria-hidden="true" />
      )}
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
        strictMode={strictMode}
        onToggleStrict={() => setStrictMode((v) => !v)}
        statusOpen={statusOpen}
        onToggleStatus={() => setStatusOpen((v) => !v)}
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
        strictMode={strictMode}
        statusOpen={statusOpen}
        onClose={() => setStatusOpen(false)}
      />
    </div>
  )
}
