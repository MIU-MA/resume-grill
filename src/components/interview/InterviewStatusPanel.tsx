import { Check, Target, X } from 'lucide-react'
import type { ResumeClaim } from '@/domain/resume-schema'

type InterviewStatusProps = {
  selected: ResumeClaim
  roundCount: number
  covered: string[]
  strictMode: boolean
  statusOpen: boolean
  onClose: () => void
}

export function InterviewStatusPanel({ selected, roundCount, covered, strictMode, statusOpen, onClose }: InterviewStatusProps) {
  const allPoints = selected.masteryPoints.map((mp) => mp.point)
  const total = allPoints.length
  const coveredSet = new Set(covered)

  return (
    <>
      <aside
        className={`w-[320px] flex-none overflow-y-auto bg-surface-soft lg:block border-line max-lg:fixed max-lg:bottom-0 max-lg:right-0 max-lg:top-[104px] max-lg:z-40 max-lg:w-[300px] max-lg:border-l max-lg:shadow-[-8px_0_24px_rgba(16,24,40,0.12)] max-lg:transition-transform max-lg:duration-200 ${
          statusOpen ? 'max-lg:translate-x-0' : 'max-lg:translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3 lg:hidden">
          <span className="text-[13px] font-semibold text-text-primary">考察状态</span>
          <button type="button" onClick={onClose} className="grid size-7 place-items-center rounded-lg bg-transparent text-text-tertiary hover:bg-surface-hover" aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-5 space-y-5">
          {/* 考察状态 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target size={14} className="text-text-tertiary" />
              <span className="text-[13px] font-semibold text-text-primary">考察状态</span>
            </div>
            {strictMode ? (
              <div className="rounded-lg border border-line bg-surface-soft px-3.5 py-3 text-[12px] leading-relaxed text-text-tertiary">
                模拟测试中，掌握要点已隐藏。切换到「学习练习」可查看完整清单、追问意图与建议回答。
              </div>
            ) : (
              <ol className="space-y-2">
                {allPoints.map((point, i) => {
                  const done = coveredSet.has(point)
                  return (
                    <li key={point} className="flex items-start gap-2 text-[13px]">
                      <span className={`size-5 flex-none rounded-full grid place-items-center ${done ? 'bg-success-soft text-success' : 'bg-line text-text-tertiary'} text-[11px] font-medium`}>
                        {done ? <Check size={11} /> : i + 1}
                      </span>
                      <span className={done ? 'text-text-secondary' : 'text-text-tertiary'}>{point}</span>
                    </li>
                  )
                })}
              </ol>
            )}
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
    </>
  )
}