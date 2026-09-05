import type { ClaimReport } from '@/features/report/report-types'

type ReportClaimListProps = {
  reports: ClaimReport[]
  activeClaimId: string | null
  doneCount: number
  onSelect: (claimId: string) => void
}

export function ReportClaimList({
  reports,
  activeClaimId,
  doneCount,
  onSelect,
}: ReportClaimListProps) {
  return (
    <aside className="overflow-hidden rounded-lg bg-white shadow-card ring-1 ring-black/[0.03]">
      <div className="border-b border-line px-4 py-3">
        <div className="text-[14px] font-bold">练习记录</div>
        <div className="mt-0.5 text-[12px] text-text-tertiary">
          已练习 {doneCount} 个要点 · 点击查看详情
        </div>
      </div>
      <div className="max-h-[calc(100dvh-132px)] divide-y divide-line overflow-y-auto max-[980px]:max-h-[360px]">
        {reports.map((report) => {
          const active = report.claim.id === activeClaimId
          const statusText =
            report.score !== null
              ? `${report.score}/5`
              : report.hasInProgress
                ? '练习中'
                : report.doneSessions.length > 0
                  ? '已练习'
                  : '未练习'

          return (
            <button
              key={report.claim.id}
              type="button"
              onClick={() => onSelect(report.claim.id)}
              className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
                active ? 'bg-brand-soft' : 'hover:bg-surface-soft'
              }`}
            >
              <span
                className={`min-w-0 truncate text-[13px] font-medium ${
                  active ? 'text-brand' : 'text-text-primary'
                }`}
              >
                {report.claim.title}
              </span>
              <span
                className={`flex-none text-[12px] font-semibold ${
                  report.score !== null
                    ? 'text-text-primary'
                    : report.hasInProgress
                      ? 'text-warning'
                      : 'text-text-tertiary'
                }`}
              >
                {statusText}
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
