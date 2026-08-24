import { Check, CircleHelp, MessageSquareText } from 'lucide-react'
import { type ResumeClaim, MASTERY_DIMENSION_LABELS, type MasteryDimension } from '@/domain/resume-schema'
import { PRIORITY_META } from '@/lib/risk'
import { Button } from '@/components/ui/Button'

const DIMENSION_CLS: Record<MasteryDimension, string> = {
  context: 'bg-blue-50 text-blue-700',
  practice: 'bg-green-50 text-green-700',
  principle: 'bg-purple-50 text-purple-700',
  decision: 'bg-amber-50 text-amber-700',
  troubleshooting: 'bg-red-50 text-red-700',
  boundary: 'bg-slate-100 text-slate-600',
}

const PRIO_CHIP_CLS: Record<string, string> = {
  red: 'bg-danger-soft text-danger',
  amber: 'bg-warning-soft text-warning',
  green: 'bg-success-soft text-success',
}

type ClaimDetailProps = {
  claim: ResumeClaim
  prepared: boolean
  mastery: number | null
  onReport: () => void
  onTogglePrepared: () => void
  onStartInterview: () => void
}

export function ClaimDetail({ claim, prepared, mastery, onReport, onTogglePrepared, onStartInterview }: ClaimDetailProps) {
  const prio = PRIORITY_META[claim.testPriority]

  return (
    <div className="h-full min-h-0 overflow-y-auto p-6">
      {/* 头部 */}
      <div className="flex items-start justify-between gap-6 pb-[22px] border-b border-line">
        <div className="min-w-0">
          <div className="text-text-tertiary text-[12px] mb-2">原始声明</div>
          <h2 className="m-0 text-[22px] leading-[1.5] tracking-[-0.02em]">"{claim.content}"</h2>
        </div>
        <div className="flex flex-col items-end gap-2 flex-none">
          <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-bold ${PRIO_CHIP_CLS[prio.color]}`}>{prio.label}</span>
          {mastery !== null && (
            <>
              <span className="text-[12px] text-text-tertiary">
                上次掌握度 <strong className="ml-1 text-success">{mastery}/5</strong>
              </span>
              <button
                type="button"
                onClick={onReport}
                className="bg-transparent text-[12px] font-semibold text-brand hover:underline"
              >
                查看报告 →
              </button>
            </>
          )}
        </div>
      </div>

      {/* 能力标签 */}
      <div className="mt-5 mb-1">
        <span className="text-text-tertiary text-[12px]">核心能力</span>
      </div>
      <div className="text-[16px] font-bold text-text-primary">{claim.capability}</div>

      {/* 双列内容 */}
      <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(270px,.8fr)] gap-7 pt-6 max-[1050px]:grid-cols-1">
        {/* 左列 */}
        <div>
          <section>
            <div className="flex items-center gap-2 text-[14px] font-bold mb-3">
              <MessageSquareText size={17} className="text-text-tertiary" />首轮追问
            </div>
            <div className="bg-surface-soft border border-line rounded-xl p-5">
              <div className="text-[15px] leading-[1.65] font-[650]">{claim.initialQuestion}</div>
            </div>
          </section>

          <section className="mt-[26px]">
            <div className="flex items-center gap-2 text-[14px] font-bold mb-3">
              <CircleHelp size={17} className="text-text-tertiary" />常见陷阱
            </div>
            <div className="space-y-2.5">
              {claim.trapPoints.length === 0 ? (
                <p className="text-[13px] text-text-secondary">暂无预判陷阱。</p>
              ) : claim.trapPoints.map((trap: string) => (
                <div key={trap} className="flex gap-3 items-start rounded-lg border border-line px-3.5 py-3 text-[13px] text-text-secondary leading-[1.6]">
                  <span className="mt-1.5 size-1.5 rounded-full bg-danger flex-none" />
                  <span>{trap}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* 右列 */}
        <aside>
          <section>
            <div className="text-[14px] font-bold mb-3">掌握要点</div>
            <div className="space-y-2.5">
              {claim.masteryPoints.map((mp, i) => (
                <div key={mp.point} className="flex items-start gap-2 text-[12px] text-text-secondary leading-[1.55]">
                  <span className="size-[19px] rounded-full grid place-items-center flex-none mt-px text-[10px] font-bold bg-surface-hover text-text-tertiary">{i + 1}</span>
                  <span>{mp.point}</span>
                  <span className={`flex-none text-[10px] rounded-md px-1.5 py-0.5 mt-px ${DIMENSION_CLS[mp.dimension]}`}>
                    {MASTERY_DIMENSION_LABELS[mp.dimension]}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* 底部操作 */}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant={prepared ? 'secondary' : 'ghost'} onClick={onTogglePrepared} aria-pressed={prepared}>
          {prepared && <Check size={15} />}{prepared ? '已准备' : '标记为已准备'}
        </Button>
        <Button variant="primary" size="large" onClick={onStartInterview}>
          <MessageSquareText size={16} />开始能力测试
        </Button>
      </div>
    </div>
  )
}