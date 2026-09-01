import type { ReportTopAction } from '@/lib/report-actions'

type ReportOverviewProps = {
  topActions: ReportTopAction[]
  doneCount: number
  totalCount: number
  weakCount: number
  summarizing: boolean
  averageScore: number | null
  averagePercent: number
  onAction: (action: ReportTopAction) => void
}

export function ReportOverview({
  topActions,
  doneCount,
  totalCount,
  weakCount,
  summarizing,
  averageScore,
  averagePercent,
  onAction,
}: ReportOverviewProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-4 max-[1050px]:grid-cols-1">
      <div className="rounded-lg bg-white p-6 shadow-card">
        <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em] text-brand">
          面试复盘
        </div>
        <h2 className="m-0 text-[21px] font-bold tracking-[-0.025em]">
          最需要处理的 3 件事
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-text-tertiary">
          已练习 {doneCount} 个简历要点。
          {summarizing ? '正在整理结果…' : '每个要点的表现和建议都在下方。'}
        </p>
        <div className="mt-5 space-y-3">
          {topActions.map((action, index) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction(action)}
              className="grid w-full grid-cols-[26px_minmax(0,1fr)_auto] items-start gap-3 bg-transparent text-left"
            >
              <span className="grid size-[26px] place-items-center rounded-lg bg-text-primary text-[11px] font-bold text-white">
                {index + 1}
              </span>
              <span className="min-w-0">
                <strong className="text-[13px] text-text-primary hover:text-brand">
                  {action.title}
                </strong>
                <span className="mt-1 block text-[12px] leading-[1.55] text-text-tertiary">
                  {action.reason}
                </span>
              </span>
              <span className="pt-1 text-[11px] font-semibold text-brand">
                {action.kind === 'untested-high'
                  ? '开始练习'
                  : action.kind === 'weak-claim'
                    ? '查看详情'
                    : '去复习'}
              </span>
            </button>
          ))}
          {topActions.length === 0 && (
            <p className="m-0 text-[13px] text-text-tertiary">
              目前没有需要优先处理的内容。
            </p>
          )}
        </div>
      </div>

      <div className="grid place-items-center rounded-lg bg-white p-6 text-center shadow-card">
        <div
          className="relative grid size-[132px] place-items-center rounded-full"
          style={{
            background: `conic-gradient(#2563eb 0 ${averagePercent}%, #e5e7eb ${averagePercent}% 100%)`,
          }}
        >
          <div className="absolute size-[102px] rounded-full bg-white" />
          <span className="relative z-10 text-[28px] font-extrabold tracking-[-0.03em]">
            {averageScore !== null ? averageScore.toFixed(1) : '--'}
            <small className="mt-1 block text-[11px] font-semibold tracking-normal text-text-tertiary">
              {averageScore === null ? '还没有分数' : '平均得分（/5）'}
            </small>
          </span>
        </div>
        <p className="mt-3 text-[11px] text-text-tertiary">
          已练习 {doneCount}/{totalCount} · 需加强 {weakCount}
        </p>
      </div>
    </div>
  )
}
