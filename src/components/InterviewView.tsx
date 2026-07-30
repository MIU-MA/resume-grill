import { useEffect, useRef } from 'react'
import { ArrowLeft, ArrowRight, Check, MessageSquareText } from 'lucide-react'
import type { ResumeClaim } from '@/domain/resume-schema'
import { Button } from '@/components/Button'

type Turn = { question: string; answer: string }

type InterviewViewProps = {
  selected: ResumeClaim
  turns: Turn[]
  currentQuestion: string | null
  currentIntent: string | null
  covered: string[]
  answer: string
  loading: boolean
  done: boolean
  version: number
  error: string | null
  onAnswerChange: (value: string) => void
  onSubmit: () => void
  onFinish: () => void
  onBackToAudit: () => void
}

export function InterviewView({
  selected,
  turns,
  currentQuestion,
  currentIntent,
  covered,
  answer,
  loading,
  done,
  version,
  error,
  onAnswerChange,
  onSubmit,
  onFinish,
  onBackToAudit,
}: InterviewViewProps) {
  const chatEndRef = useRef<HTMLDivElement>(null)
  const totalPoints = selected.evaluationPoints.length
  const coverage = totalPoints > 0 ? Math.round((covered.length / totalPoints) * 100) : 0

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns.length])

  return (
    <main className="flex min-w-0 bg-white overflow-hidden" style={{ maxHeight: 'calc(100vh - 60px)' }}>
      {/* 主面试区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部 */}
        <div className="flex h-[48px] items-center justify-between border-b border-border px-6 flex-none">
          <button type="button" className="flex items-center gap-2 text-[13px] text-text-tertiary hover:text-text-secondary bg-transparent" onClick={onBackToAudit}>
            <ArrowLeft size={15} />返回审计
          </button>
          <div className="text-center">
            <span className="text-[14px] font-semibold text-text-primary">第 {turns.length + 1} 轮追问</span>
            <span className="ml-2 text-[13px] text-text-tertiary">{selected.title}</span>
          </div>
          <span className="text-[12px] text-text-tertiary">{covered.length}/{totalPoints} 项已验证</span>
        </div>
        <div className="h-[3px] bg-border flex-none"><span className="block h-full bg-brand transition-[width] duration-300" style={{ width: `${coverage}%` }} /></div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-[680px]">
            {error && (
              <div className="rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 mb-6 text-[14px] text-danger">{error}</div>
            )}

            {/* 声明原文 */}
            <div className="rounded-lg border border-border bg-surface-soft px-4 py-3 mb-8">
              <span className="text-text-tertiary text-[12px] font-medium">正在验证的声明</span>
              <p className="mt-1 text-[14px] text-text-primary leading-relaxed">"{selected.content}"</p>
              {version > 1 && <span className="mt-2 inline-block rounded bg-brand-soft px-2 py-0.5 text-[11px] text-brand">改写版本 v{version}</span>}
            </div>

            {/* 历史问答 */}
            {turns.map((turn, i) => (
              <div key={i} className="mb-6">
                <div className="flex items-center gap-2 text-[12px] font-medium text-text-tertiary mb-1">
                  <span className="font-mono">Q{i + 1}</span>
                  <span className="h-px flex-1 bg-border" />
                  <span>面试官</span>
                </div>
                <p className="text-[15px] text-text-primary leading-relaxed mb-4">{turn.question}</p>

                <div className="flex items-center gap-2 text-[12px] font-medium text-text-tertiary mb-1">
                  <span className="font-mono">A{i + 1}</span>
                  <span className="h-px flex-1 bg-border" />
                  <span>你的回答</span>
                </div>
                <div className="rounded-lg border border-border bg-surface-soft px-4 py-3">
                  <p className="text-[14px] text-text-secondary leading-relaxed">{turn.answer}</p>
                </div>
              </div>
            ))}

            {/* 当前问题 */}
            {currentQuestion && !done && (
              <div className="rounded-lg border border-brand bg-brand-soft px-5 py-4 mb-6">
                <div className="flex items-center gap-2 text-[12px] font-medium text-brand mb-2">
                  <MessageSquareText size={14} />当前问题
                </div>
                <p className="text-[15px] font-medium text-text-primary leading-relaxed mb-1">{currentQuestion}</p>
                {currentIntent && <p className="text-[13px] text-brand">请结合实际过程回答，不需要背概念。</p>}
              </div>
            )}

            {done && (
              <div className="rounded-lg border border-success/20 bg-success-soft px-5 py-4 mb-6">
                <div className="flex items-center gap-2 text-[14px] font-medium text-success mb-1">
                  <Check size={16} />本轮追问已完成
                </div>
                <p className="text-[14px] text-text-secondary">覆盖 {covered.length}/{totalPoints} 项验证点 ({coverage}%)</p>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* 底部输入 */}
        <div className="border-t border-border bg-white px-6 py-4 flex-none">
          <div className="mx-auto max-w-[680px]">
            {!done ? (
              <div className="flex flex-col gap-3">
                <textarea
                  className="w-full resize-none rounded-xl border border-border-strong bg-white px-4 py-3 text-[14px] leading-relaxed text-text-primary placeholder:text-text-tertiary focus:border-[#60a5fa] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.1)] min-h-[140px] max-h-[200px]"
                  value={answer}
                  onChange={(event) => onAnswerChange(event.target.value)}
                  disabled={loading}
                  placeholder="按真实面试的方式回答。先说结论，再结合项目说明取舍和实现细节…"
                  rows={4}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      if (answer.trim().length >= 8 && !loading) onSubmit()
                    }
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-text-tertiary text-[12px]">Shift + Enter 换行 · 建议 80–300 字</span>
                  <Button variant="primary" size="large" disabled={answer.trim().length < 8 || loading} onClick={onSubmit} loading={loading}>
                    提交回答
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-center">
                <Button variant="primary" size="large" onClick={onFinish}>查看分析报告<ArrowRight size={16} /></Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
