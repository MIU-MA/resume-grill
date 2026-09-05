import { Check, CircleHelp, MessageSquareText } from 'lucide-react'
import { type ResumeClaim, MASTERY_DIMENSION_LABELS, type MasteryDimension, type TestPriority } from '@/domain/resume-schema'
import { PRIORITY_META } from '@/lib/risk'
import { Button } from '@/components/ui/Button'
import type { ClaimProgress } from '@/lib/risk'
import type { InterviewSession } from '@/domain/interview-schema'

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
  green: 'bg-surface-hover text-text-secondary',
}

type ClaimDetailProps = {
  claim: ResumeClaim
  priority: TestPriority
  prepared: boolean
  mastery: number | null
  onReport: () => void
  onTogglePrepared: () => void
  onStartInterview: () => void
  progress?: ClaimProgress
  historySessions?: InterviewSession[]
  onSetPriority?: (p: TestPriority) => void
}

export function ClaimDetail({
  claim,
  priority,
  prepared,
  mastery,
  onReport,
  onTogglePrepared,
  onStartInterview,
  progress,
  historySessions = [],
  onSetPriority,
}: ClaimDetailProps) {
  const prio = PRIORITY_META[priority]
  const doneSessions = historySessions.filter(
    (session) => session.status === 'done',
  )

  return (
    <div className="h-full min-h-0 overflow-y-auto p-5 md:p-6 max-[760px]:h-auto max-[760px]:overflow-visible max-[520px]:p-4">
      {/* 头部 */}
      <div className="flex items-start justify-between gap-6 border-b border-line pb-5 max-[620px]:flex-col max-[620px]:gap-3">
        <div className="min-w-0">
          <div className="text-text-tertiary text-[12px] mb-2">简历原文</div>
          <h2 className="m-0 text-[21px] leading-[1.5] tracking-[-0.02em] max-[520px]:text-[18px]">“{claim.content}”</h2>
        </div>
        <div className="flex flex-none flex-col items-end gap-2 max-[620px]:w-full max-[620px]:flex-row max-[620px]:flex-wrap max-[620px]:items-center">
          <select
            value={priority}
            onChange={(event) =>
              onSetPriority?.(event.target.value as TestPriority)
            }
            className={`h-7 cursor-pointer rounded-md border-0 px-2 text-[11px] font-bold ${PRIO_CHIP_CLS[prio.color]}`}
            aria-label="练习顺序"
          >
            <option value="high">重点练习</option>
            <option value="medium">建议练习</option>
            <option value="low">有空再练</option>
          </select>
          {mastery !== null && (
            <>
              <span className="text-[12px] text-text-tertiary">
                上次得分 <strong className="ml-1 text-success">{mastery}/5</strong>
                {progress && (
                  <span> · 聊到 {progress.covered}/{progress.total}</span>
                )}
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
        <span className="text-text-tertiary text-[12px]">主要考察</span>
      </div>
      <div className="text-[16px] font-bold text-text-primary">{claim.capability}</div>
      {doneSessions.length > 0 && (
        <section className="mt-5">
          <div className="mb-2 text-[14px] font-bold">练习记录</div>
          <div className="divide-y divide-line">
            {doneSessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between gap-4 py-2 text-[12px] text-text-secondary"
              >
                <span>
                  v{session.version} · 得分{' '}
                  {session.finalResult?.masteryScore ?? '--'}/5 · 聊到{' '}
                  {session.rounds.at(-1)?.evaluation.coveredPoints.length ?? 0}/
                  {claim.masteryPoints.length}
                </span>
                <button
                  type="button"
                  onClick={onReport}
                  className="flex-none text-brand"
                >
                  查看复盘 →
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 双列内容 */}
      <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(260px,.85fr)] gap-6 pt-6 max-[1120px]:grid-cols-1">
        {/* 左列 */}
        <div>
          <section>
            <div className="flex items-center gap-2 text-[14px] font-bold mb-3">
              <MessageSquareText size={17} className="text-text-tertiary" />开场问题
            </div>
            <div className="rounded-lg bg-surface-soft p-5">
              <div className="text-[15px] leading-[1.65] font-[650]">{claim.initialQuestion}</div>
            </div>
          </section>

          <section className="mt-[26px]">
            <div className="flex items-center gap-2 text-[14px] font-bold mb-3">
              <CircleHelp size={17} className="text-text-tertiary" />容易卡住的地方
            </div>
            <div className="space-y-2.5">
              {claim.trapPoints.length === 0 ? (
                <p className="text-[13px] text-text-secondary">暂无预判陷阱。</p>
              ) : claim.trapPoints.map((trap: string) => (
                <div key={trap} className="flex items-start gap-3 rounded-lg bg-surface-soft px-3.5 py-3 text-[13px] leading-[1.6] text-text-secondary">
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
            <div className="text-[14px] font-bold mb-3">面试官会听什么</div>
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
      <div className="mt-6 flex flex-wrap justify-end gap-2.5 max-[520px]:[&>button]:w-full">
        <Button variant={prepared ? 'secondary' : 'ghost'} onClick={onTogglePrepared} aria-pressed={prepared}>
          {prepared && <Check size={15} />}{prepared ? '已准备' : '标记为已准备'}
        </Button>
        <Button variant="primary" size="large" onClick={onStartInterview}>
          <MessageSquareText size={16} />开始模拟面试
        </Button>
      </div>
    </div>
  )
}
