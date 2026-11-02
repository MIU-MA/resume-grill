'use client'

import { stringArray, useSessionState } from '@/hooks/use-session-state'
import {
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Lightbulb,
} from 'lucide-react'
import type { InterviewTurn } from '@/features/interview/interview-view-types'

type InterviewHistoryProps = {
  turns: InterviewTurn[]
  strictMode: boolean
  scope?: string
}

export function InterviewHistory({
  turns,
  strictMode,
  scope = 'current',
}: InterviewHistoryProps) {
  const [collapsed, setCollapsed] = useSessionState<string[]>(`interview-history:${scope}`, [], stringArray)

  const toggleTurn = (index: number) => {
    setCollapsed(current => current.includes(String(index)) ? current.filter(item => item !== String(index)) : [...current, String(index)])
  }

  return <>{turns.length > 0 && <div className="mb-3 flex justify-end gap-4 text-label"><button onClick={() => setCollapsed([])}>展开全部</button><button onClick={() => setCollapsed(turns.map((_, index) => String(index)))}>收起全部</button></div>}{turns.map((turn, index) => {
    const expanded = !collapsed.includes(String(index))
    const answerNumber = turns
      .slice(0, index + 1)
      .filter((item) => item.action === 'answer').length

    return (
      <div key={index} className="mb-3 border-b border-line pb-3">
        <button
          type="button"
          onClick={() => toggleTurn(index)}
          aria-expanded={expanded}
          className="flex w-full items-center gap-2 py-1 text-left text-label text-text-tertiary"
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="font-mono">Q{index + 1}</span>
          {expanded ? <span className="flex-1 text-text-tertiary">收起</span> : <span className="min-w-0 flex-1 truncate">{turn.question}</span>}
        </button>
        {expanded && (
          <div className="pt-2">
            <div className="mb-1 flex items-center gap-2 text-meta font-medium text-text-tertiary">
              <span className="font-mono">
                {turn.action === 'answer'
                  ? `Q${answerNumber}`
                  : turn.action === 'skip'
                    ? '跳过'
                    : '澄清'}
              </span>
              <span className="h-px flex-1 bg-line" />
              <span>面试官</span>
            </div>
            <p className="mb-1 text-body leading-relaxed text-text-primary">
              {turn.question}
            </p>
            {!strictMode && turn.intent && (
              <p className="mb-4 text-meta leading-relaxed text-text-tertiary">为什么问这个：{turn.intent}</p>
            )}
            {!turn.intent && <div className="mb-4" />}

            <div className="mb-1 flex items-center gap-2 text-meta font-medium text-text-tertiary">
              <span className="font-mono">A{index + 1}</span>
              <span className="h-px flex-1 bg-line" />
              <span>{turn.action === 'skip' ? '本次操作' : '你的回答'}</span>
            </div>
            <div className="rounded-lg border border-line bg-surface-soft px-4 py-3">
              <p className="text-body leading-relaxed text-text-secondary">
                {turn.action === 'skip'
                  ? '这题跳过了，不计分。'
                  : turn.answer || '没有作答，已请面试官换一种问法。'}
              </p>
            </div>
            {!strictMode &&
              turn.evidenceQuotes &&
              turn.evidenceQuotes.length > 0 && (
                <details className="mt-1.5 pl-1 text-meta leading-relaxed text-text-tertiary"><summary className="cursor-pointer">参考内容</summary><p>
                  参考内容：{turn.evidenceQuotes.slice(0, 2).join('；')}
                </p></details>
              )}
            {turn.annotation && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-soft px-3.5 py-2.5 text-body leading-relaxed text-text-secondary">
                <CircleHelp
                  size={14}
                  className="mt-0.5 flex-none text-warning"
                />
                <span>
                  <strong className="font-semibold">没听懂：</strong>
                  {turn.annotation}
                </span>
              </div>
            )}
            {turn.action !== 'skip' &&
              (!strictMode || !turn.answer) &&
              turn.answerSuggestion && (
                <details className="mt-3 border border-brand/20 bg-brand-soft px-4 py-3">
                  <summary className="cursor-pointer text-label font-semibold text-brand">
                    <Lightbulb size={14} />
                    {turn.answer ? '建议回答' : '通俗说明'}
                  </summary>
                  <p className="mt-1.5 text-body leading-relaxed text-text-secondary">
                    {turn.answerSuggestion}
                  </p>
                </details>
              )}
          </div>
        )}
      </div>
    )
  })}</>
}
