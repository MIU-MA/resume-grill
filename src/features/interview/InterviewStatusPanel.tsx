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
        className={`w-[320px] flex-none overflow-y-auto border-l border-line bg-surface-soft max-[1199px]:fixed max-[1199px]:bottom-0 max-[1199px]:right-0 max-[1199px]:top-[56px] max-[1199px]:z-40 max-[1199px]:w-[300px] max-[1199px]:shadow-[-8px_0_24px_rgba(16,24,40,0.12)] max-[1199px]:transition-transform max-[1199px]:duration-200 ${
          statusOpen ? 'min-[1200px]:block max-[1199px]:translate-x-0' : 'min-[1200px]:hidden max-[1199px]:translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3 min-[1200px]:hidden">
          <span className="text-[13px] font-semibold text-text-primary">本轮进度</span>
          <button type="button" onClick={onClose} className="grid size-7 place-items-center rounded-lg bg-transparent text-text-tertiary hover:bg-surface-hover" aria-label="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-5 space-y-5">
          {/* 本轮进度 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target size={14} className="text-text-tertiary" />
              <span className="text-[13px] font-semibold text-text-primary">本轮进度</span>
            </div>
            {strictMode ? (
              <div className="rounded-lg border border-line bg-surface-soft px-3.5 py-3 text-[12px] leading-relaxed text-text-tertiary">
                提示已隐藏。切换到「显示提示」可查看回答要点和参考回答。
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

          {/* 当前进度 */}
          <div>
            <span className="text-[13px] font-semibold text-text-primary">当前进度</span>
            <p className="mt-2 text-[13px] text-text-secondary leading-relaxed">
              {roundCount === 0
                ? '还没有开始回答。'
                : covered.length === 0
                ? '目前还没有讲清的要点。'
                : covered.length >= total
                ? '列出的要点都已讲到，可以结束后查看复盘。'
                : `已经聊到 ${covered.length}/${total} 个要点，其余内容还没讲清或尚未问到。`}
            </p>
          </div>
        </div>
      </aside>
    </>
  )
}
