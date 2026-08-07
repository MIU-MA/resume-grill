import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowLeft, ArrowRight, Check, CircleHelp, Lightbulb, MessageSquareText, Mic, Square } from 'lucide-react'
import type { ResumeClaim } from '@/domain/resume-schema'
import type { InterviewAction } from '@/domain/interview-schema'
import { Button } from '@/components/ui/Button'
import { useSpeechInput } from '@/hooks/use-speech-input'

type Turn = { action: InterviewAction; question: string; answer: string; annotation?: string; answerSuggestion?: string; intent?: string; evidenceQuotes?: string[] }

type InterviewViewProps = {
  selected: ResumeClaim
  turns: Turn[]
  currentQuestion: string | null
  currentIntent: string | null
  covered: string[]
  answer: string
  annotation: string
  loading: boolean
  done: boolean
  version: number
  error: string | null
  onAnswerChange: Dispatch<SetStateAction<string>>
  onAnnotationChange: (value: string) => void
  onSubmit: () => void
  onSkip: () => void
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
  annotation,
  loading,
  done,
  version,
  error,
  onAnswerChange,
  onAnnotationChange,
  onSubmit,
  onSkip,
  onFinish,
  onBackToAudit,
}: InterviewViewProps) {
  const chatEndRef = useRef<HTMLDivElement>(null)
  const currentQuestionRef = useRef<HTMLDivElement>(null)
  const [annotationOpen, setAnnotationOpen] = useState(false)
  const totalPoints = selected.masteryPoints.length
  const coverage = totalPoints > 0 ? Math.round((covered.length / totalPoints) * 100) : 0
  const answeredTurnCount = turns.filter((turn) => turn.action === 'answer').length

  const [speechError, setSpeechError] = useState('')
  const speech = useSpeechInput({
    onFinalTranscript: (transcript) => {
      onAnswerChange((current) => {
        const existing = current.trimEnd()

        if (!existing) {
          return transcript
        }

        return `${existing}${needsSeparator(existing) ? '，' : ''}${transcript}`
      })
    },
    onError: (message) => {
      setSpeechError(message)
    },
  })

  const prevQuestionRef = useRef(currentQuestion)
  useEffect(() => {
    if (currentQuestion && currentQuestion !== prevQuestionRef.current) {
      // 进入新问题：自动滚到当前问题卡片
      currentQuestionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    prevQuestionRef.current = currentQuestion
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentQuestion, turns.length])

  return (
    <main className="flex h-[calc(100dvh-128px)] w-full min-w-0 overflow-hidden border-r border-border bg-white">
      {/* 主面试区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部 */}
        <div className="flex h-[48px] items-center justify-between border-b border-border px-6 flex-none">
          <button type="button" className="flex items-center gap-2 text-[13px] text-text-tertiary hover:text-text-secondary bg-transparent" onClick={onBackToAudit}>
            <ArrowLeft size={15} />返回能力清单
          </button>
          <div className="text-center">
            <span className="text-[14px] font-semibold text-text-primary">第 {answeredTurnCount + 1} 轮追问</span>
            <span className="ml-2 text-[13px] text-text-tertiary">{selected.title}</span>
            {version > 1 && <span className="ml-2 rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-brand">v{version}</span>}
          </div>
          <span className="text-[12px] text-text-tertiary">{covered.length}/{totalPoints} 项已验证</span>
        </div>
        <div className="h-[3px] bg-border flex-none"><span className="block h-full bg-brand transition-[width] duration-300" style={{ width: `${coverage}%` }} /></div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-[680px]">
            {error && (
              <div className="rounded-lg border border-danger/20 bg-danger-soft px-4 py-3 mb-6 text-[14px] text-danger">{error}</div>
            )}

            {/* 历史问答 */}
            {turns.map((turn, i) => (
              <div key={i} className="mb-6">
                <div className="flex items-center gap-2 text-[12px] font-medium text-text-tertiary mb-1">
                  <span className="font-mono">{turn.action === 'answer' ? `Q${turns.slice(0, i + 1).filter((item) => item.action === 'answer').length}` : turn.action === 'skip' ? '跳过' : '澄清'}</span>
                  <span className="h-px flex-1 bg-border" />
                  <span>面试官</span>
                </div>
                <p className="text-[15px] text-text-primary leading-relaxed mb-1">{turn.question}</p>
                {turn.intent && <p className="text-[12px] text-text-tertiary mb-4">{turn.intent}</p>}
                {!turn.intent && <div className="mb-4" />}

                <div className="flex items-center gap-2 text-[12px] font-medium text-text-tertiary mb-1">
                  <span className="font-mono">A{i + 1}</span>
                  <span className="h-px flex-1 bg-border" />
                  <span>{turn.action === 'skip' ? '本次操作' : '你的回答'}</span>
                </div>
                <div className="rounded-lg border border-border bg-surface-soft px-4 py-3">
                  <p className="text-[14px] text-text-secondary leading-relaxed">{turn.action === 'skip' ? '用户主动跳过（未验证），不会计入掌握度。' : turn.answer || '未作答，已请求换一种问法。'}</p>
                </div>
                {turn.evidenceQuotes && turn.evidenceQuotes.length > 0 && (
                  <p className="mt-1.5 pl-1 text-[12px] leading-relaxed text-text-tertiary">判定依据：{turn.evidenceQuotes.slice(0, 2).join('；')}</p>
                )}
                {turn.annotation && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-text-secondary">
                    <CircleHelp size={14} className="mt-0.5 flex-none text-warning" />
                    <span><strong className="font-semibold">不懂：</strong>{turn.annotation}</span>
                  </div>
                )}
                {turn.action !== 'skip' && turn.answerSuggestion && (
                  <div className="mt-3 rounded-lg border border-brand/20 bg-brand-soft px-4 py-3">
                    <div className="flex items-center gap-2 text-[12px] font-semibold text-brand">
                      <Lightbulb size={14} />{turn.answer ? '建议回答' : '通俗说明'}
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{turn.answerSuggestion}</p>
                  </div>
                )}
              </div>
            ))}

            {/* 当前问题 */}
            {currentQuestion && !done && (
              <div ref={currentQuestionRef} className="mb-6 scroll-mt-4">
                <div className="rounded-xl border-2 border-brand bg-white px-5 py-4 shadow-[0_1px_6px_rgba(16,24,40,0.06)]">
                  <div className="mb-1.5 flex items-center gap-2 text-[12px] font-bold text-brand">
                    <MessageSquareText size={14} />当前问题
                  </div>
                  <p className="text-[15px] font-semibold leading-relaxed text-text-primary">{currentQuestion}</p>
                  {currentIntent && <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">{currentIntent}</p>}
                </div>
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
                      if ((answer.trim().length > 0 || annotation.trim().length > 0) && !loading && !speech.listening) onSubmit()
                    }
                  }}
                />
                {speech.listening && (
                  <div className="flex items-center gap-2 text-[12px] text-brand">
                    <span className="size-2 animate-pulse rounded-full bg-danger" />
                    {speech.interimText
                      ? `正在识别：${speech.interimText}`
                      : '正在听，请开始说话…'}
                  </div>
                )}
                {speechError && !speech.listening && (
                  <div className="flex items-center gap-2 text-[12px] text-danger">
                    <CircleHelp size={13} className="flex-none" />
                    {speechError}
                  </div>
                )}
                <div>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-1.5 bg-transparent text-[12px] font-semibold ${annotationOpen || annotation ? 'text-warning' : 'text-text-tertiary hover:text-text-secondary'}`}
                    onClick={() => setAnnotationOpen((open) => !open)}
                    aria-expanded={annotationOpen}
                  >
                    <CircleHelp size={14} />这部分没听懂
                  </button>
                  {(annotationOpen || annotation) && (
                    <textarea
                      className="mt-2 w-full min-h-[72px] resize-y rounded-lg border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-text-primary placeholder:text-text-tertiary focus:border-warning focus:outline-none"
                      value={annotation}
                      onChange={(event) => onAnnotationChange(event.target.value)}
                      disabled={loading}
                      maxLength={500}
                      placeholder="写下没理解的词或问题片段，例如：不清楚“幂等性”在这里指什么"
                    />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-tertiary text-[12px]">Shift + Enter 换行 · 建议 80–300 字</span>
                  <div className="flex items-center gap-2">
                    {speech.supported && (
                      <Button
                        variant="secondary"
                        size="large"
                        disabled={loading}
                        onClick={speech.listening ? speech.stop : () => { setSpeechError(''); speech.start() }}
                      >
                        {speech.listening ? (
                          <>
                            <Square size={14} />
                            停止语音
                          </>
                        ) : (
                          <>
                            <Mic size={15} />
                            语音输入
                          </>
                        )}
                      </Button>
                    )}
                    <Button variant="secondary" size="large" disabled={loading} onClick={onSkip}>跳过此题</Button>
                    <Button variant="primary" size="large" disabled={(answer.trim().length === 0 && annotation.trim().length === 0) || loading || speech.listening} onClick={onSubmit} loading={loading}>
                      提交回答
                    </Button>
                  </div>
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

function needsSeparator(value: string) {
  return !/[，。！？；：,.!?;:]$/.test(value)
}
