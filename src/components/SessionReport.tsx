'use client'

import { ArrowRight, Clipboard } from 'lucide-react'
import { type ResumeAnalysis, type ResumeClaim } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { Button } from '@/components/Button'

type SessionReportProps = {
  analysis: ResumeAnalysis
  sessions: Record<string, InterviewSession[]>
  onRewrite: (claim: ResumeClaim, rewrittenContent: string) => void
}

export function SessionReport({ analysis, sessions, onRewrite }: SessionReportProps) {
  const sessionList = analysis.claims.map((claim) => {
    const list = sessions[claim.id] ?? []
    const latest = list[list.length - 1]
    return { claim, sessions: list, latest, status: latest?.status ?? 'todo' }
  })
  const doneSessions = sessionList.filter((s) => s.status === 'done' && s.latest?.finalResult)
  const avgConf = doneSessions.length > 0
    ? Math.round(doneSessions.reduce((sum, s) => sum + s.latest!.finalResult!.confidence, 0) / doneSessions.length / 5 * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* 总结 + score ring */}
      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-4 max-[1050px]:grid-cols-1">
        <div className="bg-white border border-border rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-6">
          <div className="text-brand text-[12px] font-bold uppercase tracking-[0.08em] mb-2">Session report</div>
          <h2 className="m-0 text-[21px] font-bold tracking-[-0.025em]">本次简历压力测试</h2>
          <p className="mt-2 text-text-tertiary text-[13px] leading-relaxed">
            已完成 {doneSessions.length} 条声明测试。当前主要风险不是基础知识，而是证据不足和表达范围过大。
          </p>
          <div className="mt-5 space-y-3">
            {doneSessions.slice(0, 3).map((s, i) => {
              const missed = s.latest!.finalResult!.cannotExplain.slice(0, 1)
              return (
                <div key={i} className="grid grid-cols-[26px_minmax(0,1fr)] gap-3 items-start">
                  <span className="w-[26px] h-[26px] rounded-lg bg-text-primary text-white grid place-items-center text-[11px] font-bold">{i + 1}</span>
                  <div>
                    <strong className="text-[13px]">{s.claim.title}</strong>
                    {missed.length > 0 && <span className="block text-text-tertiary text-[12px] leading-[1.55] mt-1">{missed[0]}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="bg-white border border-border rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-6 grid place-items-center text-center">
          <div className="relative w-[132px] h-[132px] rounded-full grid place-items-center" style={{ background: `conic-gradient(#2563eb 0 ${avgConf}%, #e5e7eb ${avgConf}% 100%)` }}>
            <div className="absolute w-[102px] h-[102px] rounded-full bg-white" />
            <span className="relative z-10 text-[28px] font-extrabold tracking-[-0.03em]">
              {avgConf}
              <small className="block text-[11px] text-text-tertiary font-semibold tracking-normal mt-1">证据完整度</small>
            </span>
          </div>
        </div>
      </div>

      {/* 改写建议 */}
      {doneSessions.length > 0 && (
        <div className="space-y-3.5">
          <h3 className="text-[18px] font-bold tracking-[-0.02em] px-1">简历改写建议</h3>
          <div className="p-4 space-y-3.5">
            {doneSessions.map(({ claim, latest }) => {
              const r = latest!.finalResult!
              return (
                <div key={claim.id} className="bg-white border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between gap-4 px-4 py-3 bg-surface-soft border-b border-border">
                    <span className="text-[13px] font-bold">{claim.title}</span>
                    <span className="text-text-tertiary text-[12px]">可信度 {r.confidence}/5</span>
                  </div>
                  <div className="grid grid-cols-2 max-[760px]:grid-cols-1">
                    <div className="p-5 min-h-[140px]">
                      <div className="text-text-tertiary text-[11px] font-bold mb-2">原文</div>
                      <p className="text-text-secondary text-[13px] leading-[1.7]">{claim.content}</p>
                    </div>
                    <div className="p-5 min-h-[140px] bg-success-soft/30 border-l border-border max-[760px]:border-l-0 max-[760px]:border-t">
                      <div className="text-text-tertiary text-[11px] font-bold mb-2">建议版本</div>
                      <p className="text-success text-[13px] leading-[1.7]">{r.rewriteSuggestion}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <Button variant="ghost" className="text-[12px]" onClick={() => onRewrite(claim, r.rewriteSuggestion)}>
                          <ArrowRight size={13} />重新测试
                        </Button>
                        <Button variant="ghost" className="text-[12px]" onClick={() => navigator.clipboard?.writeText(r.rewriteSuggestion)}>
                          <Clipboard size={13} />复制
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
