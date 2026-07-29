import { useEffect, useRef } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleHelp, Loader2, MessageSquareText, Sparkles } from 'lucide-react'
import type { ResumeClaim } from '@/domain/resume-schema'
import type { InterviewTurn } from '@/domain/interview-schema'
import { Button } from '@/components/Button'

type CurrentQuestion = { question: string; intent: string }

type InterviewViewProps = {
  selected: ResumeClaim
  turns: InterviewTurn[]
  currentQuestion: CurrentQuestion | null
  covered: string[]
  missing: string[]
  answer: string
  loading: boolean
  done: boolean
  showHint: boolean
  onAnswerChange: (value: string) => void
  onToggleHint: () => void
  onSubmit: () => void
  onFinish: () => void
  onBackToAudit: () => void
}

// 聊天气泡：面试官（左对齐，中性灰）
function InterviewerBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 max-w-[85%]">
      <div className="grid size-7 place-items-center rounded-full bg-[#e7ecef] text-[#28343a] flex-none mt-0.5">
        <MessageSquareText size={13} />
      </div>
      <div className="rounded-xl rounded-tl-[4px] bg-[#f0f3f5] px-3.5 py-2.5 text-[12px] leading-[1.55] text-[#30373c]">
        {children}
      </div>
    </div>
  )
}

// 用户气泡（右对齐，品牌色）
function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-xl rounded-tr-[4px] bg-brand px-3.5 py-2.5 text-[12px] leading-[1.55] text-white">
        {children}
      </div>
    </div>
  )
}

// 系统消息（居中，浅色）
function SystemMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-center">
      <span className="rounded-full bg-[#eef1f2] px-3 py-1 text-faint text-[9px]">{children}</span>
    </div>
  )
}

export function InterviewView({
  selected,
  turns,
  currentQuestion,
  covered,
  missing,
  answer,
  loading,
  done,
  showHint,
  onAnswerChange,
  onToggleHint,
  onSubmit,
  onFinish,
  onBackToAudit,
}: InterviewViewProps) {
  const totalPoints = selected.evaluationPoints.length
  const coverage = totalPoints > 0 ? Math.round((covered.length / totalPoints) * 100) : 0
  const roundLabel = done ? `已完成 ${turns.length} 轮` : `第 ${turns.length + 1} 轮`
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns.length, currentQuestion])

  return (
    <main className="flex flex-col min-w-0 bg-canvas" style={{ maxHeight: 'calc(100vh - 54px)' }}>
      {/* 顶部栏 */}
      <div className="flex h-[44px] items-center justify-between border-b border-line bg-white px-5 flex-none">
        <button type="button" className="flex items-center gap-1.5 bg-transparent text-muted text-[10px] hover:text-ink" onClick={onBackToAudit}>
          <ArrowLeft size={14} />返回
        </button>
        <div className="flex items-center gap-2 text-center min-w-0">
          <strong className="text-[11px] text-[#1a2024] truncate max-w-[200px]">{selected.title}</strong>
          <span className="text-faint text-[9px] flex-none">· {roundLabel}</span>
        </div>
      </div>
      <div className="h-[3px] bg-[#e4e8ea] flex-none"><span className="block h-full bg-brand transition-[width] duration-300" style={{ width: `${coverage}%` }} /></div>

      {/* 聊天区 — 可滚动 */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mx-auto max-w-[640px] flex flex-col gap-3">
          {/* 系统消息：声明原文 */}
          <SystemMsg>正在验证声明</SystemMsg>
          <div className="rounded-lg border border-line bg-white px-3.5 py-2.5 text-[11px] leading-[1.6] text-[#4f5960]">
            “{selected.quote}”
          </div>

          {/* 历史对话 */}
          {turns.map((turn, i) => (
            <div key={i} className="flex flex-col gap-3">
              <InterviewerBubble>{turn.question}</InterviewerBubble>
              <UserBubble>{turn.answer}</UserBubble>
            </div>
          ))}

          {/* 当前追问 */}
          {currentQuestion && !done && (
            <InterviewerBubble>{currentQuestion.question}</InterviewerBubble>
          )}

          {/* 完成消息 */}
          {done && (
            <SystemMsg>本轮追问已完成 · 覆盖 {covered.length}/{totalPoints} 要点 · {coverage}%</SystemMsg>
          )}

          {/* 覆盖进度提示 */}
          {turns.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex flex-wrap gap-1.5">
                {selected.evaluationPoints.map((point) => (
                  <span
                    key={point}
                    className={`rounded px-2 py-0.5 text-[8px] ${covered.includes(point) ? 'text-green bg-green-soft' : 'text-faint bg-[#eef1f2]'}`}
                  >
                    {covered.includes(point) && <Check size={10} className="inline mr-1" />}
                    {point}
                  </span>
                ))}
              </div>
              {missing.length > 0 && (
                <p className="flex items-start gap-1 text-[9px] text-amber">
                  <AlertTriangle size={11} className="mt-0.5 flex-none" />
                  建议补充：{missing.slice(0, 3).join('、')}
                </p>
              )}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* 底部输入栏 */}
      <div className="border-t border-line bg-white px-5 py-3 flex-none">
        <div className="mx-auto max-w-[640px]">
          {!done ? (
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col gap-1.5">
                <textarea
                  className="w-full resize-none rounded-lg border border-line-strong bg-white px-3 py-2 text-[11px] leading-[1.6] text-[#283136] placeholder:text-faint min-h-[52px] max-h-[120px]"
                  value={answer}
                  onChange={(event) => onAnswerChange(event.target.value)}
                  disabled={loading || done}
                  placeholder="按真实面试的方式回答…"
                  rows={2}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      if (answer.trim().length >= 8 && !loading) onSubmit()
                    }
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Button variant="primary" className="h-full px-4 flex-col gap-1" disabled={answer.trim().length < 8 || loading} onClick={onSubmit}>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                  <span className="text-[9px]">{loading ? '…' : '发送'}</span>
                </Button>
                <Button variant="secondary" className="h-8 px-2" onClick={onToggleHint}>
                  <CircleHelp size={12} />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <Button variant="primary" size="large" onClick={onFinish}>完成本轮<ArrowRight size={15} /></Button>
            </div>
          )}

          {showHint && !done && (
            <div className="mt-2 flex gap-2 rounded-md border border-[#ead5ae] bg-amber-soft p-2.5 text-[#72521e]">
              <Sparkles size={14} className="flex-none mt-0.5" />
              <div>
                <strong className="block text-[9px]">回答应覆盖</strong>
                <p className="m-0 mt-0.5 text-[9px] leading-[1.45]">{selected.evaluationPoints.join('、')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
