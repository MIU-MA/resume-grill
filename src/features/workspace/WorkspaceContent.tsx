'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import type { ResumeAnalysis, ResumeClaim, TestPriority } from '@/domain/resume-schema'
import type { InterviewAction, InterviewSession } from '@/domain/interview-schema'
import type { Mode } from '@/application/types'
import { ClaimAuditView } from '@/features/audit/ClaimAuditView'
import { InterviewView } from '@/features/interview/InterviewView'
import { InterviewStatusPanel } from '@/features/interview/InterviewStatusPanel'
import { InterviewReportView } from '@/features/report/InterviewReportView'
import { KnowledgeView } from '@/features/knowledge/KnowledgeView'
import type { KnowledgeItem, KnowledgeItemInput, KnowledgeItemPatch } from '@/lib/knowledge'
import type { ClaimProgress } from '@/lib/risk'
import { ResumeDiagnosisReport } from '@/features/resume/ResumeDiagnosisReport'

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
  onNavigate: (mode: Mode) => void
  mode: Mode
  analysis: ResumeAnalysis
  sessions: Record<string, InterviewSession[]>
  error: string | null
  audit: AuditContent
  knowledge: KnowledgeContent
  report: ReportContent
  interview: InterviewContent
}

export function WorkspaceContent(props: WorkspaceContentProps) {
  const isPractice = ['audit', 'interview', 'report'].includes(props.mode)
  return <div className="flex h-full min-h-0 flex-col bg-white">
    {isPractice && <header className="practice-header">
      <h1>面试练习</h1>
      <nav aria-label="面试练习阶段" className="practice-stages">
        {([{ mode: 'audit', label: '准备内容' }, { mode: 'interview', label: '开始面试' }, { mode: 'report', label: '面试复盘' }] as const).map((item, index) => <button key={item.mode} onClick={() => props.onNavigate(item.mode)} aria-current={props.mode === item.mode ? 'page' : undefined}><span aria-hidden="true">0{index + 1}</span>{item.label}</button>)}
      </nav>
    </header>}
    <div className="min-h-0 flex-1"><WorkspaceBody {...props} /></div>
  </div>
}

function WorkspaceBody({
  onNavigate,
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
  const [statusOpen, setStatusOpen] = useState(false)

  if (mode === 'diagnosis') {
    return <div className="resume-workbench h-full min-h-0 bg-white">
      {analysis.diagnosis ? <ResumeDiagnosisReport diagnosis={analysis.diagnosis} /> : <p className="m-0 p-5 text-[13px] leading-relaxed text-text-secondary">这份记录还没有简历检查结果。重新导入同一份简历即可检查；相同内容的练习记录会保留。</p>}
    </div>
  }

  if (mode === 'report') {
    return (
      <div className="h-full overflow-y-auto px-3 pb-10 pt-4 sm:px-4 md:px-6 md:pt-5">
        <div className="mx-auto max-w-[clamp(1320px,62vw,1580px)]">
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
          onStartInterview={() => onNavigate('interview')}
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
      <div className="h-full overflow-y-auto px-3 pb-10 pt-4 sm:px-4 md:px-6 md:pt-5">
        <div className="mx-auto max-w-[clamp(1320px,62vw,1580px)]">
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

  if (!interview.view.currentQuestion && !interview.view.loading && !interview.view.done && interview.view.rounds.length === 0) {
    return <section className="h-full overflow-auto p-5 sm:p-8" aria-label="面试开始前">
      <div className="max-w-[900px]">
        <h2 className="mb-2 mt-0 text-[20px] font-semibold">本次练习</h2>
        <p className="mb-6 text-[13px] text-text-secondary">围绕所选经历进行问答，提交回答后继续追问，结束后查看复盘。</p>
        <div className="border-y border-line py-5"><p className="mb-2 mt-0 text-[12px] text-text-tertiary">已选内容</p><h3 className="my-2 text-[16px] font-semibold">{interview.selected.title}</h3><p className="mb-0 text-[14px] leading-relaxed text-text-secondary">{interview.selected.content}</p></div>
        {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
        <div className="mt-6 flex gap-3"><button className="border border-brand bg-brand px-5 py-2 text-[13px] text-white" onClick={audit.onStartInterview}>开始问答</button><button className="border border-line px-5 py-2 text-[13px]" onClick={interview.onBackToAudit}>更换练习内容</button></div>
      </div>
    </section>
  }

  return (
    <div className="h-full min-h-0">
      <div className="relative flex h-full min-h-0 overflow-hidden bg-white">
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
    </div>
  )
}
