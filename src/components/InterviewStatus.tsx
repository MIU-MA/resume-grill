import { Check, Target } from 'lucide-react'
import type { ResumeClaim } from '@/domain/resume-schema'

type InterviewStatusProps = {
  selected: ResumeClaim
  roundCount: number
  covered: string[]
}

export function InterviewStatus({ selected, roundCount, covered }: InterviewStatusProps) {
  const total = selected.evaluationPoints.length
  const coverage = total > 0 ? Math.round((covered.length / total) * 100) : 0
  const coveredSet = new Set(covered)

  return (
    <aside className="w-[320px] flex-none overflow-y-auto border-l border-border bg-surface-soft max-lg:hidden" style={{ maxHeight: 'calc(100vh - 60px)' }}>
      <div className="px-5 py-5 space-y-5">
        {/* 本轮进度 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold text-text-primary">本轮进度</span>
            <span className="text-text-tertiary text-[12px]">{covered.length}/{total} 项</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-border">
            <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${coverage}%` }} />
          </div>
          <p className="mt-1 text-[12px] text-text-tertiary">{coverage}%</p>
        </div>

        {/* 考察状态 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} className="text-text-tertiary" />
            <span className="text-[13px] font-semibold text-text-primary">考察状态</span>
          </div>
          <ol className="space-y-2">
            {selected.evaluationPoints.map((point, i) => {
              const done = coveredSet.has(point)
              return (
                <li key={point} className="flex items-start gap-2 text-[13px]">
                  <span className={`size-5 flex-none rounded-full grid place-items-center ${done ? 'bg-success-soft text-success' : 'bg-border text-text-tertiary'} text-[11px] font-medium`}>
                    {done ? <Check size={11} /> : i + 1}
                  </span>
                  <span className={done ? 'text-text-secondary' : 'text-text-tertiary'}>{point}</span>
                </li>
              )
            })}
          </ol>
        </div>

        {/* 当前判断 */}
        <div>
          <span className="text-[13px] font-semibold text-text-primary">当前判断</span>
          <p className="mt-2 text-[13px] text-text-secondary leading-relaxed">
            {roundCount === 0
              ? '面试尚未开始。'
              : covered.length === 0
              ? '候选人尚未给出有效回答。'
              : covered.length >= total
              ? '候选人已覆盖全部考察要点，回答质量较高。'
              : `候选人已覆盖 ${covered.length}/${total} 项要点，尚需验证其余方面。`}
          </p>
        </div>
      </div>
    </aside>
  )
}
