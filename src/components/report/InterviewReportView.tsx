'use client'

import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  RefreshCw,
  Target,
} from 'lucide-react'
import { type ResumeAnalysis, type ResumeClaim } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { Button } from '@/components/ui/Button'
import { deriveBlindSpots } from '@/lib/blind-spots'
import { diffRewrite } from '@/lib/rewrite-diff'
import type { DiffSentence } from '@/lib/rewrite-diff'

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

type ClaimReport = {
  claim: ResumeClaim
  doneSessions: InterviewSession[]
  hasInProgress: boolean
  latest: InterviewSession | null
  score: number | null
}

export function InterviewReportView({
  analysis,
  sessions,
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
        const list = (sessions[claim.id] ?? []).slice().sort((a, b) => a.version - b.version)
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

  const masteredSet = new Set(masteredBlindSpotIds)
  const blindSpots = deriveBlindSpots(analysis, sessions)
    .sort((a, b) => Number(masteredSet.has(a.id)) - Number(masteredSet.has(b.id)))
  const unresolvedBlindSpots = blindSpots.filter((spot) => !masteredSet.has(spot.id)).length

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
      {/* 总体结论 + score ring */}
      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-4 max-[1050px]:grid-cols-1">
        <div className="bg-white border border-line rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-6">
          <div className="text-brand text-[12px] font-bold uppercase tracking-[0.08em] mb-2">能力测试报告</div>
          <h2 className="m-0 text-[21px] font-bold tracking-[-0.025em]">本次能力测试</h2>
          <p className="mt-2 text-text-tertiary text-[13px] leading-relaxed">
            已完成 {doneCount} 条声明测试。{summarizing ? '正在生成总结…' : '单条结论与证据在下方按声明查看。'}
          </p>
          <div className="mt-5 space-y-3">
            {readyReports.slice(0, 3).map((r, i) => {
              if (r.score === null) return null
              const missed = r.latest?.finalResult?.cannotExplain.slice(0, 1) ?? []
              return (
                <div key={r.claim.id} className="grid grid-cols-[26px_minmax(0,1fr)] gap-3 items-start">
                  <span className="w-[26px] h-[26px] rounded-lg bg-text-primary text-white grid place-items-center text-[11px] font-bold">{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => setActiveClaimId(r.claim.id)}
                    className="bg-transparent text-left min-w-0"
                  >
                    <strong className="text-[13px] text-text-primary hover:text-brand">{r.claim.title}</strong>
                    {missed.length > 0 && <span className="block text-text-tertiary text-[12px] leading-[1.55] mt-1">{missed[0]}</span>}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
        <div className="bg-white border border-line rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] p-6 grid place-items-center text-center">
          <div className="relative w-[132px] h-[132px] rounded-full grid place-items-center" style={{ background: `conic-gradient(#2563eb 0 ${avgPct}%, #e5e7eb ${avgPct}% 100%)` }}>
            <div className="absolute w-[102px] h-[102px] rounded-full bg-white" />
            <span className="relative z-10 text-[28px] font-extrabold tracking-[-0.03em]">
              {avg05 != null ? avg05.toFixed(1) : '--'}
              <small className="block text-[11px] text-text-tertiary font-semibold tracking-normal mt-1">{avg05 === null ? '暂无评分' : '掌握度（/5）'}</small>
            </span>
          </div>
        </div>
      </div>

      {analysis.jobMatch && (
        <section className="bg-white border border-line rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.04)] overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-line bg-surface-soft px-5 py-4">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-brand" />
              <div>
                <h2 className="m-0 text-[15px] font-bold">岗位匹配</h2>
                <p className="mt-1 text-[12px] text-text-tertiary">根据目标岗位描述检查简历证据。</p>
              </div>
            </div>
            <span className="text-[12px] text-text-tertiary">{analysis.jobMatch.requirements.length} 项要求</span>
          </div>
          <div className="divide-y divide-line">
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
            <div className="grid grid-cols-2 gap-4 border-t border-line px-5 py-4 max-[720px]:grid-cols-1">
              <ReportFact label="岗位缺口" value={joinReportItems(analysis.jobMatch.gaps)} tone="warning" />
              <ReportFact label="建议优先追问" value={joinReportItems(analysis.jobMatch.interviewFocus)} />
            </div>
          )}
        </section>
      )}

      {blindSpots.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-line bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between gap-4 border-b border-line bg-surface-soft px-5 py-4">
            <div className="flex items-center gap-2.5">
              <BookOpen size={17} className="text-brand" />
              <div>
                <h2 className="m-0 text-[15px] font-bold">知识盲区</h2>
                <p className="mt-1 text-[12px] text-text-tertiary">来自能力测试中标记的「没听懂」，并保留当时的问题语境。</p>
              </div>
            </div>
            <span className="text-[12px] font-semibold text-warning">{unresolvedBlindSpots} 项未掌握</span>
          </div>
          <div className="divide-y divide-line">
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
                      <Check size={13} />{mastered ? '改回未掌握' : '标记已掌握'}
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

      {/* 主从布局：左侧声明列表 + 右侧单条报告 */}
      <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-4 items-start max-[980px]:grid-cols-1">
        <aside className="rounded-xl border border-line bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)] overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <div className="text-[14px] font-bold">测试记录</div>
            <div className="mt-0.5 text-[12px] text-text-tertiary">{doneCount} 条已完成 · 点击查看详情</div>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y divide-line">
            {reports.map((r) => {
              const active = r.claim.id === activeReport?.claim.id
              const statusText =
                r.score !== null ? `${r.score}/5`
                : r.hasInProgress ? '进行中'
                : r.doneSessions.length > 0 ? '已测试' : '未测试'
              return (
                <button
                  key={r.claim.id}
                  type="button"
                  onClick={() => setActiveClaimId(r.claim.id)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${active ? 'bg-brand-soft' : 'hover:bg-surface-soft'}`}
                >
                  <span className={`min-w-0 truncate text-[13px] font-medium ${active ? 'text-brand' : 'text-text-primary'}`}>{r.claim.title}</span>
                  <span className={`flex-none text-[12px] font-semibold ${r.score !== null ? 'text-text-primary' : r.hasInProgress ? 'text-warning' : 'text-text-tertiary'}`}>
                    {statusText}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <article className="min-w-0 rounded-xl border border-line bg-white shadow-[0_1px_3px_rgba(16,24,40,0.04)] overflow-hidden">
          {!activeReport || !selectedSession ? (
            <div className="grid place-items-center px-6 py-20 text-center">
              <div>
                <Target size={26} className="mx-auto mb-3 text-text-tertiary" />
                <p className="m-0 text-[14px] font-semibold text-text-primary">{activeReport?.hasInProgress ? '测试进行中' : '该声明尚未测试'}</p>
                <p className="mt-2 text-[12px] text-text-tertiary">完成一次能力测试后，这里会展示结论、证据与改写建议。</p>
                {activeReport && (
                  <Button variant="primary" className="mt-4" onClick={() => onRetest(activeReport.claim)}>
                    <ArrowRight size={14} />开始测试
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

type ClaimReportDetailProps = {
  claim: ResumeClaim
  session: InterviewSession
  sessions: InterviewSession[]
  delta: number | null
  regeneratingId: string | null
  onVersionChange: (version: number) => void
  onRetest: () => void
  onRewrite: (claim: ResumeClaim, rewrittenContent: string) => void
  onRegenerateSummary: (claim: ResumeClaim, session: InterviewSession) => void
}

function ClaimReportDetail({
  claim,
  session,
  sessions,
  delta,
  regeneratingId,
  onVersionChange,
  onRetest,
  onRewrite,
  onRegenerateSummary,
}: ClaimReportDetailProps) {
  const result = session.finalResult!
  const isLoading = session.finalResult == null
  const isFailed = session.summaryStatus === 'failed'
  const multiVersion = sessions.filter((s) => s.finalResult).length > 1
  const originalText = session.claimContent || claim.content

  if (isLoading) {
    return (
      <div className="p-6 space-y-3 animate-pulse">
        <div className="h-4 w-1/3 rounded bg-line" />
        <div className="h-3 w-2/3 rounded bg-line" />
        <div className="h-3 w-1/2 rounded bg-line" />
      </div>
    )
  }

  if (isFailed) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="m-0 text-[13px] font-semibold text-text-primary">{claim.title}</p>
            <p className="mt-1 text-[12px] text-warning">总结生成失败，问答记录已经保存。</p>
          </div>
          <Button
            variant="secondary"
            disabled={regeneratingId === session.id}
            onClick={() => onRegenerateSummary(claim, session)}
          >
            <RefreshCw size={13} />{regeneratingId === session.id ? '正在生成…' : '重新生成报告'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* 头部：标题 + 版本选择 + 分数 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-text-tertiary text-[12px] mb-1">单条结论</div>
          <h3 className="m-0 text-[18px] font-bold tracking-[-0.02em]">{claim.title}</h3>
        </div>
        <div className="flex items-center gap-3">
          {multiVersion && (
            <label className="flex items-center gap-2 text-[12px] text-text-tertiary">
              版本
              <select
                className="h-[30px] rounded-lg border border-line bg-white px-2 text-[12px] text-text-secondary cursor-pointer"
                value={session.version}
                onChange={(e) => onVersionChange(Number(e.target.value))}
              >
                {sessions.filter((s) => s.finalResult).map((s) => (
                  <option key={s.id} value={s.version}>
                    v{s.version}（{s.finalResult!.masteryScore}/5）
                  </option>
                ))}
              </select>
            </label>
          )}
          {delta !== null && (
            <span className={`rounded-md px-2 py-0.5 text-[12px] font-bold ${delta >= 0 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}>
              {delta >= 0 ? `+${delta}` : delta}
            </span>
          )}
          <strong className="text-[22px] tracking-[-0.02em]">{result.masteryScore}<span className="text-[14px] text-text-tertiary">/5</span></strong>
        </div>
      </div>

      {/* 四个要点 */}
      <div className="mt-5 grid grid-cols-2 gap-4 max-[560px]:grid-cols-1">
        <ReportFact label="回答结论" value={result.answerSummary || '暂无结论'} />
        <ReportFact label="已讲清" value={joinReportItems(result.canExplain)} tone="success" />
        <ReportFact label="尚未讲清" value={joinReportItems(result.cannotExplain)} tone="warning" />
        <ReportFact label="知识盲区" value={joinReportItems(result.knowledgeGaps)} />
      </div>
      {result.nextAction && (
        <div className="mt-4 border-t border-line pt-4">
          <ReportFact label="下一步行动" value={result.nextAction} />
        </div>
      )}

      {/* 回答原文 + 判定依据 */}
      {session.rounds.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <div className="text-[13px] font-bold mb-2">回答原文与判定依据</div>
          <div className="space-y-2">
            {session.rounds.map((r, i) => (
              <details key={`${session.id}-${i}`} className="group rounded-lg border border-line px-3.5 py-2.5">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-[12px] font-medium text-text-primary">
                  <ChevronDown size={14} className="text-text-tertiary transition-transform group-open:rotate-180" />
                  <span>Q{i + 1}</span>
                  <span className="truncate text-text-tertiary">{r.question}</span>
                </summary>
                <div className="mt-2.5 space-y-2 pl-6 text-[12px] leading-relaxed">
                  <p className="text-text-secondary">{r.answer || '未作答'}</p>
                  {(r.evaluation.evidenceQuotes?.length ?? 0) > 0 && (
                    <p className="text-text-tertiary">判定依据：{r.evaluation.evidenceQuotes.slice(0, 3).join('；')}</p>
                  )}
                  {r.annotation && <p className="text-warning">没听懂：{r.annotation}</p>}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* 简历改写对比 */}
      <div className="mt-5 border-t border-line pt-4">
        <div className="flex items-center gap-2">
          <div className="text-[13px] font-bold">简历改写对比</div>
          <span className="text-[11px] text-text-tertiary">高亮 = 实际发生变化</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
          <div className="rounded-lg border border-line bg-surface-soft px-4 py-3">
            <div className="mb-2 text-[11px] font-bold text-text-tertiary">原文</div>
            <div className="space-y-1.5">
              {diffRewrite(originalText, result.rewriteSuggestion).original.map((s, i) => (
                <DiffLine key={i} sentence={s} side="original" />
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-success/20 bg-success-soft/20 px-4 py-3">
            <div className="mb-2 text-[11px] font-bold text-text-tertiary">建议版本</div>
            <div className="space-y-1.5">
              {diffRewrite(originalText, result.rewriteSuggestion).suggestion.map((s, i) => (
                <DiffLine key={i} sentence={s} side="suggestion" />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button variant="ghost" className="text-[12px]" onClick={() => onRewrite(claim, result.rewriteSuggestion)}>
                <ArrowRight size={13} />重新测试
              </Button>
              <Button variant="ghost" className="text-[12px]" onClick={() => navigator.clipboard?.writeText(result.rewriteSuggestion)}>
                <Clipboard size={13} />复制
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <Button variant="secondary" onClick={onRetest}>
          <RefreshCw size={14} />重新测试该声明
        </Button>
      </div>
    </div>
  )
}

function DiffLine({ sentence, side }: { sentence: DiffSentence; side: 'original' | 'suggestion' }) {
  if (side === 'original') {
    const removed = sentence.kind !== 'same'
    return (
      <p className={`text-[12px] leading-[1.7] ${removed ? 'text-text-tertiary line-through decoration-danger/40' : 'text-text-secondary'}`}>
        {sentence.text}
      </p>
    )
  }
  const cls =
    sentence.kind === 'added'
      ? 'rounded bg-success-soft text-success px-0.5'
      : sentence.kind === 'changed'
        ? 'rounded bg-brand-soft text-brand px-0.5'
        : 'text-text-secondary'
  return <p className={`text-[12px] leading-[1.7] ${cls}`}>{sentence.text}</p>
}

function joinReportItems(items: string[]): string {
  return items.length > 0 ? items.slice(0, 3).join('；') : '暂无记录'
}

function ReportFact({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'success' | 'warning' }) {
  return (
    <div className="min-w-0 rounded-lg border border-line px-3.5 py-3">
      <div className="mb-1 text-[11px] font-bold text-text-tertiary">{label}</div>
      <p className={`m-0 text-[12px] leading-[1.6] ${tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-text-secondary'}`}>{value}</p>
    </div>
  )
}