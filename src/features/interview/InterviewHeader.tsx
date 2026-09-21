import { ArrowLeft, List } from 'lucide-react'

type InterviewHeaderProps = {
  title: string
  version: number
  roundNumber: number
  coveredCount: number
  totalCount: number
  coveragePercent: number
  strictMode: boolean
  statusOpen: boolean
  onBack: () => void
  onToggleStrict: () => void
  onToggleStatus: () => void
}

export function InterviewHeader({
  title,
  version,
  roundNumber,
  coveredCount,
  totalCount,
  coveragePercent,
  strictMode,
  statusOpen,
  onBack,
  onToggleStrict,
  onToggleStatus,
}: InterviewHeaderProps) {
  return (
    <>
      <div className="grid h-12 flex-none grid-cols-[minmax(32px,1fr)_auto_minmax(32px,1fr)] items-center gap-3 border-b border-line px-4 sm:px-5 md:px-6">
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 justify-self-start bg-transparent text-[13px] text-text-tertiary hover:text-text-secondary"
          onClick={onBack}
        >
          <ArrowLeft size={15} />
          <span className="max-[720px]:hidden">返回准备内容</span>
        </button>
        <div className="min-w-0 text-center">
          <span className="text-[14px] font-semibold text-text-primary">
            第 {roundNumber} 轮追问
          </span>
          <span className="ml-2 text-[13px] text-text-tertiary max-[640px]:hidden">
            {title}
          </span>
          {version > 1 && (
            <span className="ml-2 rounded bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium text-brand">
              v{version}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 justify-self-end">
          <button
            type="button"
            onClick={onToggleStatus}
            className="inline-flex h-[28px] items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-[12px] font-medium text-text-secondary"
            aria-pressed={statusOpen}
            title="展开回答要点"
          >
            <List size={14} /><span className="max-[520px]:hidden">要点</span>
          </button>
          <div className="inline-flex items-center rounded-lg bg-surface-soft p-0.5 text-[12px] font-medium max-[430px]:hidden">
            <button
              type="button"
              onClick={() => {
                if (!strictMode) onToggleStrict()
              }}
              className={`h-[24px] rounded-[6px] px-2.5 transition-colors ${
                strictMode
                  ? 'bg-white text-text-primary shadow-[0_1px_2px_rgba(16,24,40,0.08)]'
                  : 'bg-transparent text-text-tertiary hover:text-text-secondary'
              }`}
              aria-pressed={strictMode}
              title="隐藏提示，按真实面试来回答"
            >
              隐藏提示
            </button>
            <button
              type="button"
              onClick={() => {
                if (strictMode) onToggleStrict()
              }}
              className={`h-[24px] rounded-[6px] px-2.5 transition-colors ${
                !strictMode
                  ? 'bg-white text-text-primary shadow-[0_1px_2px_rgba(16,24,40,0.08)]'
                  : 'bg-transparent text-text-tertiary hover:text-text-secondary'
              }`}
              aria-pressed={!strictMode}
              title="显示提示和参考回答"
            >
              显示提示
            </button>
          </div>
          <span className="text-[12px] text-text-tertiary max-[900px]:hidden">
            已聊到 {coveredCount}/{totalCount}
          </span>
        </div>
      </div>
      <div className="h-[3px] flex-none bg-line">
        <span
          className="block h-full bg-brand transition-[width] duration-300"
          style={{ width: `${coveragePercent}%` }}
        />
      </div>
    </>
  )
}
