import { ArrowRight, ChevronDown, Clipboard, RefreshCw } from 'lucide-react'
import type { ResumeClaim } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { Button } from '@/components/ui/Button'
import { diffRewrite, type DiffSentence } from '@/lib/rewrite-diff'

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

export function ClaimReportDetail({
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
  const evidenceQuotes = [...new Set(session.rounds.flatMap((round) => round.evaluation.evidenceQuotes ?? []))].slice(0, 3)

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
            <p className="mt-1 text-[12px] text-warning">结果整理失败，问答记录已经保存。</p>
          </div>
          <Button
            variant="secondary"
            disabled={regeneratingId === session.id}
            onClick={() => onRegenerateSummary(claim, session)}
          >
            <RefreshCw size={13} />{regeneratingId === session.id ? '正在整理…' : '重新整理'}
          </Button>
        </div>
      </div>
    )
  }

  const confidence =
    result.masteryScore >= 4
      ? { label: '回答扎实', className: 'bg-success-soft text-success' }
      : result.masteryScore >= 2
        ? { label: '基本答到了', className: 'bg-warning-soft text-warning' }
        : { label: '没答出来', className: 'bg-danger-soft text-danger' }
  const unclearItems = [
    ...new Set([...result.cannotExplain, ...result.knowledgeGaps]),
  ]

  return (
    <div className="p-6">
      {/* 头部：标题 + 版本选择 + 分数 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-text-tertiary text-[12px] mb-1">本轮表现</div>
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

      <section className="mt-5 border-t border-line pt-4">
        <div className="mb-2 flex items-center gap-2">
          <strong className="text-[13px]">总体表现</strong>
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${confidence.className}`}
          >
            {confidence.label}
          </span>
        </div>
        <p className="text-[13px] leading-relaxed text-text-secondary">
          {result.answerSummary || '还没有总结。'}
        </p>
      </section>

      <section className="mt-5 border-t border-line pt-4">
        <div className="mb-3 text-[13px] font-bold">答得好的地方</div>
        <div className="space-y-2">
          {(evidenceQuotes.length ? evidenceQuotes : result.canExplain)
            .slice(0, 3)
            .map((quote) => (
              <blockquote
                key={quote}
                className="border-l-2 border-success/40 bg-surface-soft py-2 pl-3 text-[12px] leading-relaxed text-text-secondary"
              >
                {quote}
              </blockquote>
            ))}
          {evidenceQuotes.length === 0 && result.canExplain.length === 0 && (
            <p className="text-[12px] text-text-tertiary">
              这轮还没有答出明确内容。
            </p>
          )}
        </div>
      </section>

      <section className="mt-5 border-t border-line pt-4">
        <div className="mb-3 text-[13px] font-bold">还没说清楚</div>
        <div className="space-y-2">
          {unclearItems.map((item) => (
            <div
              key={item}
              className="flex items-start gap-2 text-[12px] leading-relaxed text-text-secondary"
            >
              <i className="mt-1.5 size-1.5 flex-none rounded-full bg-warning" />
              {item}
            </div>
          ))}
          {unclearItems.length === 0 && (
            <p className="text-[12px] text-text-tertiary">
              这轮没有明显问题。
            </p>
          )}
        </div>
      </section>

      {result.nextAction && (
        <section className="mt-5 border-t border-line pt-4">
          <div className="mb-2 text-[13px] font-bold">接下来怎么练</div>
          <a
            href={`#rewrite-${session.id}`}
            className="block rounded-lg bg-brand-soft px-4 py-3 text-[13px] leading-relaxed text-brand"
          >
            {result.nextAction}
          </a>
        </section>
      )}

      {/* 问答记录 */}
      {session.rounds.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <div className="text-[13px] font-bold mb-2">问答记录</div>
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
                    <p className="text-text-tertiary">参考内容：{r.evaluation.evidenceQuotes.slice(0, 3).join('；')}</p>
                  )}
                  {r.annotation && <p className="text-warning">没听懂：{r.annotation}</p>}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* 简历改写对比 */}
      <div id={`rewrite-${session.id}`} className="mt-5 scroll-mt-4 border-t border-line pt-4">
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
                <ArrowRight size={13} />用新版再练
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
          <RefreshCw size={14} />再练一次
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
