'use client'

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowRight, CircleHelp, Mic, MoreHorizontal, Square } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useDropdown } from '@/hooks/use-dropdown'
import { useSpeechInput } from '@/hooks/use-speech-input'
import { useSessionState } from '@/hooks/use-session-state'
import { InterviewTools } from './InterviewTools'

type InterviewComposerProps = {
  scope?: string
  answer: string
  annotation: string
  loading: boolean
  done: boolean
  onAnswerChange: Dispatch<SetStateAction<string>>
  onAnnotationChange: (value: string) => void
  onSubmit: () => void
  onSkip: () => void
  onFinish: () => void
}

export function InterviewComposer({
  answer,
  annotation,
  loading,
  done,
  onAnswerChange,
  onAnnotationChange,
  onSubmit,
  onSkip,
  onFinish,
  scope = 'current',
}: InterviewComposerProps) {
  const answerRef = useRef<HTMLTextAreaElement>(null)
  const [annotationOpen, setAnnotationOpen] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const [code, setCode] = useSessionState(`interview-code:${scope}`, '', (value): value is string => typeof value === 'string')
  const skipMenu = useDropdown()
  const speech = useSpeechInput({
    onFinalTranscript: (transcript) => {
      onAnswerChange((current) => {
        const existing = current.trimEnd()
        if (!existing) return transcript
        return `${existing}${needsSeparator(existing) ? '，' : ''}${transcript}`
      })
    },
    onError: setSpeechError,
  })

  useEffect(() => {
    const field = answerRef.current
    if (!field) return
    field.style.height = 'auto'
    field.style.height = `${Math.min(field.scrollHeight, 200)}px`
  }, [answer])

  const isClarifyOnly = !answer.trim() && annotation.trim().length > 0
  const canSubmit = (answer.trim().length > 0 || annotation.trim().length > 0) && !loading && !speech.listening

  return (
    <div className="flex-none border-t border-line bg-white px-4 py-3.5 sm:px-6 sm:py-4">
      <div className="mx-auto max-w-[clamp(720px,44vw,940px)]">
        {done ? (
          <div className="flex justify-center">
            <Button variant="primary" size="large" onClick={onFinish}>
              查看面试复盘<ArrowRight size={16} />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <InterviewTools scope={scope} answer={answer} />
            <details><summary className="text-label text-text-secondary">经历题的回答提示</summary><p className="my-2 text-meta">可以先交代背景与目标，再说你亲自做了什么、结果如何。技术原理题直接回答原理与取舍即可；没有可靠数字时说明观察方法，不编结果。</p></details>
            <details><summary className="text-label text-text-secondary">代码 / 架构草稿</summary><textarea aria-label="代码或架构草稿" className="mail-input my-2 min-h-28 whitespace-pre font-mono" value={code} disabled={loading} maxLength={8000} onChange={event => setCode(event.target.value)} placeholder="写代码、伪代码或架构说明。加入回答后一起评估。" /><button disabled={loading || !code.trim()} onClick={() => { onAnswerChange(current => `${current}\n\n代码 / 架构草稿：\n\`\`\`\n${code}\n\`\`\``); setCode('') }}>加入本次回答</button></details>
            <textarea
              ref={answerRef}
              className="min-h-[64px] max-h-[200px] w-full resize-none overflow-y-auto rounded-lg border border-line-strong bg-white px-4 py-3 text-label leading-relaxed text-text-primary placeholder:text-text-tertiary focus:border-brand focus:ring-[3px] focus:ring-brand/10"
              value={answer}
              onChange={(event) => onAnswerChange(event.target.value)}
              disabled={loading}
              placeholder="写下你的回答，也可以用语音输入…"
              rows={2}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
                event.preventDefault()
                if (canSubmit) onSubmit()
              }}
            />
            {speech.listening && (
              <div className="flex items-center gap-2 text-body text-brand">
                <span className="size-2 animate-pulse rounded-full bg-danger" />
                {speech.interimText ? `正在识别：${speech.interimText}` : '正在听，请开始说话…'}
              </div>
            )}
            {speechError && !speech.listening && (
              <div className="flex items-center gap-2 text-body text-danger">
                <CircleHelp size={13} className="flex-none" />{speechError}
              </div>
            )}
            <div>
              <button
                type="button"
                className={`inline-flex items-center gap-1.5 bg-transparent text-label font-semibold ${annotationOpen || annotation ? 'text-warning' : 'text-text-tertiary hover:text-text-secondary'}`}
                onClick={() => setAnnotationOpen((open) => !open)}
                aria-expanded={annotationOpen}
              >
                <CircleHelp size={14} />这题哪里没懂？
              </button>
              {(annotationOpen || annotation) && (
                <textarea
                  className="mt-2 min-h-[72px] w-full resize-y rounded-lg border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-label leading-relaxed text-text-primary placeholder:text-text-tertiary focus:border-warning focus:outline-none"
                  value={annotation}
                  onChange={(event) => onAnnotationChange(event.target.value)}
                  disabled={loading}
                  maxLength={500}
                  placeholder="例如：这里的“幂等性”是什么意思？"
                />
              )}
            </div>
            <div className="flex items-center justify-between gap-3 max-[640px]:items-end">
              <span className="text-meta text-text-tertiary max-[640px]:hidden">Enter 发送 · Shift + Enter 换行</span>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                {speech.supported && (
                  <Button
                    variant="secondary"
                    size="large"
                    className="max-[480px]:px-3"
                    disabled={loading}
                    onClick={speech.listening ? speech.stop : () => { setSpeechError(''); speech.start() }}
                  >
                    {speech.listening ? <><Square size={14} /><span className="max-[480px]:hidden">停止语音</span></> : <><Mic size={15} /><span className="max-[480px]:hidden">语音输入</span></>}
                  </Button>
                )}
                <div ref={skipMenu.ref} className="relative">
                  <button
                    type="button"
                    onClick={skipMenu.toggle}
                    disabled={loading}
                    className="grid size-9 place-items-center rounded-md border border-line bg-white text-text-secondary hover:bg-surface-hover"
                    aria-label="更多操作"
                    aria-expanded={skipMenu.open}
                  >
                    <MoreHorizontal size={17} />
                  </button>
                  {skipMenu.open && (
                    <div className="absolute bottom-full right-0 z-20 mb-1 w-32 rounded-lg border border-line bg-white p-1 shadow-[0_8px_24px_rgba(16,24,40,.12)]">
                      <button
                        type="button"
                        onClick={() => { skipMenu.close(); onSkip() }}
                        className="w-full rounded-md px-3 py-2 text-left text-label text-text-secondary hover:bg-surface-hover"
                      >
                        跳过此题
                      </button>
                    </div>
                  )}
                </div>
                <Button variant="primary" size="large" className="max-[480px]:px-3" disabled={!canSubmit} onClick={onSubmit} loading={loading}>
                  {isClarifyOnly ? '请求通俗解释' : '提交回答'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function needsSeparator(value: string) {
  return !/[，。！？；：,.!?;:]$/.test(value)
}
