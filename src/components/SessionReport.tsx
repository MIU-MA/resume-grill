'use client'

import { ArrowLeft, Check, FileDown, AlertTriangle, RotateCcw } from 'lucide-react'
import { CLAIM_CATEGORY_LABELS, type ResumeAnalysis, type ResumeClaim } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { claimRisk, type RiskMeta } from '@/lib/risk'
import { Button } from '@/components/Button'

const RISK_DOT: Record<RiskMeta['color'], string> = {
  red: 'bg-red shadow-[0_0_0_3px_var(--color-red-soft)]',
  amber: 'bg-amber shadow-[0_0_0_3px_var(--color-amber-soft)]',
  green: 'bg-green shadow-[0_0_0_3px_var(--color-green-soft)]',
}

const STATUS_BORDER: Record<string, string> = {
  in_progress: 'border-l-[3px] border-l-brand',
  done: 'border-l-[3px] border-l-green',
  todo: 'border-l-[3px] border-l-line-strong',
}

const STATUS_BADGE: Record<string, string> = {
  done: 'text-green bg-green-soft',
  in_progress: 'text-brand bg-brand-soft',
  todo: 'text-faint bg-[#eef1f2]',
}

const STATUS_LABEL: Record<string, string> = {
  done: '已完成',
  in_progress: '进行中',
  todo: '未追问',
}

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
    <main className="min-w-0 bg-canvas">
      <div className="flex h-[46px] items-center justify-between bg-white px-6 border-b border-line">
        <button type="button" className="flex items-center gap-[6px] bg-transparent text-muted text-[10px] hover:text-ink" onClick={onBack}><ArrowLeft size={15} />返回</button>
        <span className="text-muted font-mono text-[10px] font-600">会话报告 · 已完成 {doneCount} · 进行中 {inProgressCount}</span>
      </div>

      <section className="bg-surface border-b border-line px-[30px] pt-7 pb-[22px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-[5px] text-brand text-[10px] font-750 uppercase">简历改写报告</div>
            <h1 className="mt-[6px] mb-[6px] text-[20px] text-[#182025]">{analysis.candidate} · {analysis.role}</h1>
            <p className="m-0 max-w-[640px] text-muted text-[11px] leading-[1.6]">{analysis.summary}</p>
          </div>
          <Button variant="primary" onClick={onExport}><FileDown size={14} />导出完整报告</Button>
        </div>
      </section>

      <section className="flex flex-col gap-[14px] px-[30px] pt-[22px] pb-10">
        {sessionList.map(({ claim, session }) => {
          const risk = claimRisk(claim.askLikelihood, claim.evidenceStrength)
          const status = session?.status ?? 'todo'
          return (
            <article key={claim.quote} className={`rounded-md border border-line bg-white px-5 py-[18px] ${STATUS_BORDER[status]}`}>
              <div className="flex items-center gap-[9px]">
                <span className={`size-[6px] rounded-full ${RISK_DOT[risk.color]}`} />
                <div className="flex min-w-0 flex-col">
                  <small className="text-faint text-[10px]">{CLAIM_CATEGORY_LABELS[claim.category]} · {claim.role}</small>
                  <strong className="text-[11px] font-650 text-[#30373c]">{claim.title}</strong>
                </div>
                <span className={`ml-auto rounded px-2 py-[3px] text-[10px] font-650 ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>
              </div>

              <blockquote className="m-0 my-3 border-l-[3px] border-[#9eabb3] bg-[#f5f7f8] px-3 py-[10px] text-[11px] leading-[1.6] text-[#4f5960]">“{claim.quote}”</blockquote>

              {session ? (
                <div className="mt-3 flex flex-col gap-3">
                  <div className="flex gap-[14px] text-muted text-[10px]">
                    <span>{session.turns.length} 轮</span>
                    <span>覆盖 {session.coveredPoints.length}/{claim.evaluationPoints.length} 要点</span>
                  </div>
                  {session.finalSummary && (
                    <div>
                      <h3 className="flex items-center gap-[6px] m-0 mb-[6px] text-[10px] text-[#465057]"><Check size={13} className="text-green" />结论</h3>
                      <p className="m-0 text-muted text-[10px] leading-[1.6]">{session.finalSummary}</p>
                    </div>
                  )}
                  {session.missingPoints.length > 0 && (
                    <div>
                      <h3 className="flex items-center gap-[6px] m-0 mb-[6px] text-[10px] text-[#465057]"><AlertTriangle size={13} className="text-amber" />仍缺失</h3>
                      <p className="m-0 text-muted text-[10px] leading-[1.6]">{session.missingPoints.join('；')}</p>
                    </div>
                  )}
                  {session.rewriteSuggestion && (
                    <div>
                      <h3 className="m-0 mb-[6px] text-[10px] text-[#465057]">改写建议</h3>
                      <pre className="m-0 whitespace-pre-wrap break-words rounded-[4px] border border-[#cfe6da] bg-[#f1f7f3] px-3 py-[10px] text-[10px] leading-[1.7] text-[#2a3328]">{session.rewriteSuggestion}</pre>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="secondary" className="h-[30px] px-3" onClick={() => onSelect(claim)}>查看声明</Button>
                    <Button variant="secondary" className="h-[30px] px-3" onClick={() => onRedo(claim)}><RotateCcw size={13} />重新追问</Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button variant="primary" className="h-[30px] px-3" onClick={() => onRedo(claim)}>开始追问</Button>
                  <Button variant="secondary" className="h-[30px] px-3" onClick={() => onSelect(claim)}>查看声明</Button>
                </div>
              )}
            </article>
          )
        })}
      </section>
    </main>
  )
}
