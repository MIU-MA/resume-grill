'use client'

import { ArrowLeft, Check, FileDown, AlertTriangle, RotateCcw } from 'lucide-react'
import { CLAIM_CATEGORY_LABELS, type ResumeAnalysis, type ResumeClaim } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { claimRisk } from '@/lib/risk'

type SessionReportProps = {
  analysis: ResumeAnalysis
  sessions: Record<string, InterviewSession>
  onBack: () => void
  onExport: () => void
  onRedo: (claim: ResumeClaim) => void
  onSelect: (claim: ResumeClaim) => void
}

export function SessionReport({ analysis, sessions, onBack, onExport, onRedo, onSelect }: SessionReportProps) {
  const sessionList = analysis.claims.map((claim) => ({ claim, session: sessions[claim.quote] }))
  const doneCount = sessionList.filter((s) => s.session?.status === 'done').length
  const inProgressCount = sessionList.filter((s) => s.session?.status === 'in_progress').length

  return (
    <main className="audit-main">
      <div className="interview-topline">
        <button type="button" onClick={onBack}><ArrowLeft size={15} />返回</button>
        <span>会话报告 · 已完成 {doneCount} · 进行中 {inProgressCount}</span>
      </div>

      <section className="report-overview">
        <div className="report-overview-head">
          <div>
            <div className="eyebrow">简历改写报告</div>
            <h1>{analysis.candidate} · {analysis.role}</h1>
            <p>{analysis.summary}</p>
          </div>
          <button type="button" className="button primary" onClick={onExport}><FileDown size={14} />导出完整报告</button>
        </div>
      </section>

      <section className="report-claims">
        {sessionList.map(({ claim, session }) => {
          const risk = claimRisk(claim.askLikelihood, claim.evidenceStrength)
          return (
            <article key={claim.quote} className={`report-claim ${session?.status ?? 'todo'}`}>
              <div className="report-claim-head">
                <span className={`risk-dot ${risk.color}`} />
                <div className="claim-item-copy">
                  <small>{CLAIM_CATEGORY_LABELS[claim.category]} · {claim.role}</small>
                  <strong>{claim.title}</strong>
                </div>
                <span className={`report-status ${session?.status ?? 'todo'}`}>
                  {session?.status === 'done' ? '已完成' : session?.status === 'in_progress' ? '进行中' : '未追问'}
                </span>
              </div>

              <blockquote className="report-quote">“{claim.quote}”</blockquote>

              {session ? (
                <div className="report-session">
                  <div className="report-meta">
                    <span>{session.turns.length} 轮</span>
                    <span>覆盖 {session.coveredPoints.length}/{claim.evaluationPoints.length} 要点</span>
                  </div>
                  {session.finalSummary && (
                    <div className="report-block">
                      <h3><Check size={13} />结论</h3>
                      <p>{session.finalSummary}</p>
                    </div>
                  )}
                  {session.missingPoints.length > 0 && (
                    <div className="report-block gaps">
                      <h3><AlertTriangle size={13} />仍缺失</h3>
                      <p>{session.missingPoints.join('；')}</p>
                    </div>
                  )}
                  {session.rewriteSuggestion && (
                    <div className="report-block rewrite">
                      <h3>改写建议</h3>
                      <pre>{session.rewriteSuggestion}</pre>
                    </div>
                  )}
                  <div className="report-actions">
                    <button type="button" className="button secondary" onClick={() => onSelect(claim)}>查看声明</button>
                    <button type="button" className="button secondary" onClick={() => onRedo(claim)}><RotateCcw size={13} />重新追问</button>
                  </div>
                </div>
              ) : (
                <div className="report-actions">
                  <button type="button" className="button primary" onClick={() => onRedo(claim)}>开始追问</button>
                  <button type="button" className="button secondary" onClick={() => onSelect(claim)}>查看声明</button>
                </div>
              )}
            </article>
          )
        })}
      </section>
    </main>
  )
}
