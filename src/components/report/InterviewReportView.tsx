'use client'

import { AlertTriangle, ArrowRight, BookOpen, Check, CheckCircle2, Clipboard, RefreshCw, Target } from 'lucide-react'
import { type ResumeAnalysis, type ResumeClaim } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { Button } from '@/components/ui/Button'
import { deriveBlindSpots } from '@/lib/blind-spots'

type InterviewReportViewProps = {
  analysis: ResumeAnalysis
  sessions: Record<string, InterviewSession[]>
  masteredBlindSpotIds: string[]
  onToggleBlindSpot: (blindSpotId: string) => void
  onRetest: (claim: ResumeClaim) => void
  onRewrite: (claim: ResumeClaim, rewrittenContent: string) => void
  onRegenerateSummary: (claim: ResumeClaim, session: InterviewSession) => void
  regeneratingId: string | null
}

export function InterviewReportView({ analysis, sessions, masteredBlindSpotIds, onToggleBlindSpot, onRetest, onRewrite, onRegenerateSummary, regeneratingId }: InterviewReportViewProps) {
  const sessionList = analysis.claims.map((claim) => {
    const list = sessions[claim.id] ?? []
    const latest = list[list.length - 1]
    return { claim, sessions: list, latest, status: latest?.status ?? 'todo' }
  })
  const doneSessions = sessionList.filter((s) => s.status === 'done')
  const hasFinal = (s: typeof doneSessions[number]) => s.latest?.finalResult != null
  const summarizing = doneSessions.some((s) => !hasFinal(s) && s.latest?.summaryStatus === undefined)
  const scoredSessions = doneSessions.filter((s) => hasFinal(s) && s.latest?.summaryStatus !== 'failed')
  const avgScore = scoredSessions.length > 0
    ? Math.round(scoredSessions.reduce((sum, s) => sum + s.latest!.finalResult!.masteryScore, 0) / scoredSessions.length / 5 * 100)
    : null
  const masteredSet = new Set(masteredBlindSpotIds)
  const blindSpots = deriveBlindSpots(analysis, sessions)
    .sort((a, b) => Number(masteredSet.has(a.id)) - Number(masteredSet.has(b.id)))
  const unresolvedBlindSpots = blindSpots.filter((spot) => !masteredSet.has(spot.id)).length
  const allDoneSessions = analysis.claims.flatMap((claim) =>
    (sessions[claim.id] ?? [])
      .filter((session) => session.status === 'done')
      .map((session) => ({ claim, session })),
  )

  return (
    <div className="space-y-4">
      {/* 总结 + score ring */}
      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-4 max-[1050px]:grid-cols-1">
        <div className="bg-white border border-border rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-6">
          <div className="text-brand text-[12px] font-bold uppercase tracking-[0.08em] mb-2">能力测试报告</div>
          <h2 className="m-0 text-[21px] font-bold tracking-[-0.025em]">本次能力测试</h2>
          <p className="mt-2 text-text-tertiary text-[13px] leading-relaxed">
            已完成 {doneSessions.length} 条声明测试。{summarizing ? '正在生成总结…' : ' '}
          </p>
          <div className="mt-5 space-y-3">
            {doneSessions.slice(0, 3).map((s, i) => {
              const r = s.latest?.finalResult
              if (!r) return null
              const missed = r.cannotExplain.slice(0, 1)
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
          <div className="relative w-[132px] h-[132px] rounded-full grid place-items-center" style={{ background: `conic-gradient(#2563eb 0 ${avgScore ?? 0}%, #e5e7eb ${avgScore ?? 0}% 100%)` }}>
            <div className="absolute w-[102px] h-[102px] rounded-full bg-white" />
            <span className="relative z-10 text-[28px] font-extrabold tracking-[-0.03em]">
              {avgScore ?? '--'}
              <small className="block text-[11px] text-text-tertiary font-semibold tracking-normal mt-1">{avgScore === null ? '暂无评分' : '掌握度'}</small>
            </span>
          </div>
        </div>
      </div>

      {analysis.jobMatch && (
        <section className="bg-white border border-border rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-border bg-surface-soft px-5 py-4">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-brand" />
              <div>
                <h2 className="m-0 text-[15px] font-bold">岗位匹配</h2>
                <p className="mt-1 text-[12px] text-text-tertiary">根据目标岗位描述检查简历证据。</p>
              </div>
            </div>
            <span className="text-[12px] text-text-tertiary">{analysis.jobMatch.requirements.length} 项要求</span>
          </div>
          <div className="divide-y divide-border">
            {analysis.jobMatch.requirements.map((item) => (
              <div key={item.requirement} className="grid grid-cols-[92px_minmax(0,1fr)_minmax(0,1.2fr)] gap-4 px-5 py-3.5 max-[720px]:grid-cols-1 max-[720px]:gap-1.5">
                <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${item.match === 'strong' ? 'text-success' : item.match === 'partial' ? 'text-warning' : 'text-danger'}`}>
                  {item.match === 'strong' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  {item.match === 'strong' ? '匹配较好' : item.match === 'partial' ? '部分匹配' : '缺少证据'}
                </div>
                <p className="m-0 text-[13px] leading-relaxed text-text-primary">{item.requirement}</p>
                <div className="text-[12px] leading-relaxed text-text-tertiary">
                  <p className="m-0">{item.note}</p>
                  {item.evidence.length > 0 && <p className="mt-1 text-text-secondary">证据：{item.evidence.slice(0, 1).join('')}</p>}
                </div>
              </div>
            ))}
          </div>
          {(analysis.jobMatch.gaps.length > 0 || analysis.jobMatch.interviewFocus.length > 0) && (
            <div className="grid grid-cols-2 gap-4 border-t border-border px-5 py-4 max-[720px]:grid-cols-1">
              <ReportFact label="岗位缺口" value={joinReportItems(analysis.jobMatch.gaps)} tone="warning" />
              <ReportFact label="建议优先追问" value={joinReportItems(analysis.jobMatch.interviewFocus)} />
            </div>
          )}
        </section>
      )}

      {blindSpots.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-border bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between gap-4 border-b border-border bg-surface-soft px-5 py-4">
            <div className="flex items-center gap-2.5">
              <BookOpen size={17} className="text-brand" />
              <div>
                <h2 className="m-0 text-[15px] font-bold">待补强知识点</h2>
                <p className="mt-1 text-[12px] text-text-tertiary">来自能力测试中的不懂批注，并保留当时的问题语境。</p>
              </div>
            </div>
            <span className="text-[12px] font-semibold text-warning">{unresolvedBlindSpots} 项待补强</span>
          </div>
          <div className="divide-y divide-border">
            {blindSpots.map((spot) => {
              const mastered = masteredSet.has(spot.id)
              return (
                <div key={spot.id} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-5 px-5 py-4 max-[720px]:grid-cols-1 ${mastered ? 'bg-success-soft/25' : ''}`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-[13px] text-text-primary">{spot.annotation}</strong>
                      <span className="rounded bg-surface-hover px-2 py-0.5 text-[10px] font-semibold text-text-tertiary">{spot.claim.title}</span>
                      {mastered && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success"><Check size={12} />已掌握</span>}
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-text-tertiary">当时问题：{spot.question}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">{spot.explanation || '当时没有生成通俗说明，建议重新测试。'}</p>
                  </div>
                  <div className="flex items-center gap-2 self-center max-[720px]:justify-end">
                    <Button variant="ghost" className="text-[12px]" onClick={() => onToggleBlindSpot(spot.id)}>
                      <Check size={13} />{mastered ? '重新标为待补强' : '标记已掌握'}
                    </Button>
                    <Button variant="secondary" className="text-[12px]" onClick={() => onRetest(spot.claim)}>
                      <RefreshCw size={13} />重新测试
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 改写建议 */}
      {allDoneSessions.length > 0 && (
        <div className="space-y-3.5">
          <h3 className="text-[18px] font-bold tracking-[-0.02em] px-1">简历改写建议</h3>
          <div className="p-4 space-y-3.5">
            {allDoneSessions.map(({ claim, session }) => {
              const result = session.finalResult
              const isFailed = session.summaryStatus === 'failed'
              const isLoading = session.status === 'done' && session.summaryStatus === undefined && result === null
              const versionCount = (sessions[claim.id] ?? []).filter((s) => s.status === 'done').length
              const showVersion = versionCount > 1
              return (
                <div key={`${claim.id}:${session.id}`} className="bg-white border border-border rounded-xl overflow-hidden">
                  {isLoading ? (
                      <div className="p-5 space-y-3 animate-pulse">
                        <div className="h-4 w-1/3 rounded bg-border" />
                        <div className="h-3 w-2/3 rounded bg-border" />
                        <div className="h-3 w-1/2 rounded bg-border" />
                      </div>
                    ) : isFailed ? (
                      <div className="flex items-center justify-between gap-4 p-5">
                        <div>
                          <p className="flex items-center gap-2 text-[13px] font-semibold text-text-primary">
                            {claim.title}
                            {showVersion && <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-brand">v{session.version}</span>}
                          </p>
                          <p className="mt-1 text-[12px] text-warning">总结生成失败，问答记录已经保存。</p>
                        </div>
                        <Button
                          variant="secondary"
                          className="text-[12px]"
                          disabled={regeneratingId === session.id}
                          onClick={() => onRegenerateSummary(claim, session)}
                        >
                          <RefreshCw size={13} />{regeneratingId === session.id ? '正在生成…' : '重新生成报告'}
                        </Button>
                      </div>
                    ) : result ? (
                      <>
                    <div className="flex items-center justify-between gap-4 px-4 py-3 bg-surface-soft border-b border-border">
                      <span className="flex items-center gap-2 text-[13px] font-bold">
                        {claim.title}
                        {showVersion && <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-brand">v{session.version}</span>}
                      </span>
                      <span className="text-text-tertiary text-[12px]">掌握度 {result.masteryScore}/5</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 border-b border-border px-5 py-4 max-[900px]:grid-cols-2 max-[520px]:grid-cols-1">
                      <ReportFact label="回答结论" value={result.answerSummary || '暂无结论'} />
                      <ReportFact label="已讲清" value={joinReportItems(result.canExplain)} tone="success" />
                      <ReportFact label="尚未讲清" value={joinReportItems(result.cannotExplain)} tone="warning" />
                      <ReportFact label="待补强知识点" value={joinReportItems(result.knowledgeGaps)} />
                    </div>
                    {result.nextAction && (
                      <div className="border-b border-border px-5 py-3">
                        <ReportFact label="下一步行动" value={result.nextAction} />
                      </div>
                    )}
                    <div className="grid grid-cols-2 max-[760px]:grid-cols-1">
                      <div className="p-5 min-h-[140px]">
                        <div className="text-text-tertiary text-[11px] font-bold mb-2">原文</div>
                        <p className="text-text-secondary text-[13px] leading-[1.7]">{session.claimContent || claim.content}</p>
                      </div>
                      <div className="p-5 min-h-[140px] bg-success-soft/30 border-l border-border max-[760px]:border-l-0 max-[760px]:border-t">
                        <div className="text-text-tertiary text-[11px] font-bold mb-2">建议版本</div>
                        <p className="text-success text-[13px] leading-[1.7]">{result.rewriteSuggestion}</p>
                        <div className="flex items-center gap-2 mt-3">
                          <Button variant="ghost" className="text-[12px]" onClick={() => onRewrite(claim, result.rewriteSuggestion)}>
                            <ArrowRight size={13} />重新测试
                          </Button>
                          <Button variant="ghost" className="text-[12px]" onClick={() => navigator.clipboard?.writeText(result.rewriteSuggestion)}>
                            <Clipboard size={13} />复制
                          </Button>
                        </div>
                      </div>
                    </div>
                    </>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function joinReportItems(items: string[]): string {
  return items.length > 0 ? items.slice(0, 2).join('；') : '暂无记录'
}

function ReportFact({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' | 'warning' }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] font-bold text-text-tertiary">{label}</div>
      <p className={`m-0 text-[12px] leading-[1.6] ${tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-text-secondary'}`}>{value}</p>
    </div>
  )
}
