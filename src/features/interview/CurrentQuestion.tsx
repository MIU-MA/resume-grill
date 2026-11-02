'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, MessageSquareText } from 'lucide-react'

type CurrentQuestionProps = {
  question: string | null
  intent: string | null
  done: boolean
  strictMode: boolean
  coveredCount: number
  totalCount: number
  coveragePercent: number
  sectionRef: React.RefObject<HTMLDivElement | null>
}

export function CurrentQuestion({
  question,
  intent,
  done,
  strictMode,
  coveredCount,
  totalCount,
  coveragePercent,
  sectionRef,
}: CurrentQuestionProps) {
  const [intentOpen, setIntentOpen] = useState(false)

  useEffect(() => {
    setIntentOpen(false)
  }, [question])

  if (done) {
    return (
      <div className="mb-6 rounded-lg border border-success/20 bg-success-soft px-5 py-4">
        <div className="mb-1 flex items-center gap-2 text-body font-medium text-success">
          <Check size={16} />这轮练习结束了
        </div>
        <p className="text-body text-text-secondary">
          聊到 {coveredCount}/{totalCount} 个要点 ({coveragePercent}%)
        </p>
      </div>
    )
  }

  if (!question) return null

  return (
    <div ref={sectionRef} className="mb-6 scroll-mt-4">
      <div className="border border-line border-l-2 border-l-brand bg-white px-5 py-4">
        <div className="mb-1.5 flex items-center gap-2 text-body font-bold text-brand">
          <MessageSquareText size={14} />当前问题
        </div>
        <p className="text-body font-semibold leading-relaxed text-text-primary">{question}</p>
        {intent && !strictMode && (
          <p className="mt-1 text-body leading-relaxed text-text-secondary">{intent}</p>
        )}
        {intent && strictMode && (
          <>
            <button
              type="button"
              onClick={() => setIntentOpen((open) => !open)}
              className="mt-1.5 inline-flex items-center gap-1 bg-transparent text-label font-medium text-text-tertiary hover:text-text-secondary"
              aria-expanded={intentOpen}
            >
              <ChevronDown size={12} className={`transition-transform ${intentOpen ? 'rotate-180' : ''}`} />
              为什么问这个
            </button>
            {intentOpen && (
              <p className="mt-1 text-body leading-relaxed text-text-secondary">{intent}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
