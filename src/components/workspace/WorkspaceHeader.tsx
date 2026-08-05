'use client'

import type { Mode } from '@/types'

type WorkspaceHeaderProps = {
  mode: Mode
  highCount: number
  totalMasteryPoints: number
  claimCount: number
  completedClaimCount: number
  coveredLength: number
  onTabChange: (tab: Mode) => void
}

const TABS: { key: Mode; label: string }[] = [
  { key: 'audit', label: '能力清单' },
  { key: 'interview', label: '能力测试' },
  { key: 'report', label: '测试报告' },
]

const STATS: Array<
  [string, (p: WorkspaceHeaderProps) => string | number, string, string]
> = [
  ['优先测试', (p) => p.highCount, 'text-danger', '能力要点多，建议优先追问'],
  ['能力要点', (p) => p.totalMasteryPoints, 'text-warning', '覆盖各项核心维度'],
  ['可追问声明', (p) => p.claimCount, '', '覆盖项目、技能和成果'],
  [
    '已完成测试',
    (p) => `${p.completedClaimCount} / ${p.claimCount}`,
    'text-success',
    '',
  ],
]

export function WorkspaceHeader({
  mode,
  highCount,
  totalMasteryPoints,
  claimCount,
  completedClaimCount,
  coveredLength,
  onTabChange,
}: WorkspaceHeaderProps) {
  const props: WorkspaceHeaderProps = {
    mode,
    highCount,
    totalMasteryPoints,
    claimCount,
    completedClaimCount,
    coveredLength,
    onTabChange,
  }

  return (
    <>
      {/* ── 标题栏 + 模式切换 ─────────────────────────── */}
      <section className="flex items-end justify-between gap-6 mb-5">
        <div>
          <div className="text-brand text-[12px] font-bold uppercase tracking-[0.08em] mb-2">
            能力清单
          </div>
          <h1 className="m-0 text-[28px] font-bold tracking-[-0.035em]">
            找出简历中最容易被问穿的那句话
          </h1>
          <p className="mt-2 text-text-tertiary text-[14px] leading-relaxed">
            不判断简历真假，而是通过追问检查你是否真正掌握了所写的能力。
          </p>
        </div>
        <div
          className="inline-flex bg-[#eceff3] rounded-[10px] p-1 gap-0.5 flex-none"
          role="tablist"
        >
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              className={`h-[34px] px-4 rounded-[7px] text-[13px] font-semibold transition-colors ${
                mode === key
                  ? 'bg-white text-text-primary shadow-[0_1px_3px_rgba(16,24,40,0.04)]'
                  : 'bg-transparent text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* ── 统计卡片 ──────────────────────────────────── */}
      <section className="grid grid-cols-4 gap-3 mb-[18px] max-[1050px]:grid-cols-2 max-[480px]:grid-cols-1">
        {STATS.map(([label, getValue, color, hint]) => (
          <div
            key={label}
            className="bg-white border border-border rounded-xl p-4 shadow-[0_1px_3px_rgba(16,24,40,0.04)]"
          >
            <div className="text-text-tertiary text-[12px] mb-2">{label}</div>
            <div
              className={`text-[22px] font-[750] tracking-[-0.025em] ${color}`}
            >
              {getValue(props)}
            </div>
            <div className="text-text-tertiary text-[12px] mt-1.5">
              {label === '已完成测试'
                ? `已验证 ${coveredLength} 个考察点`
                : hint}
            </div>
          </div>
        ))}
      </section>
    </>
  )
}
