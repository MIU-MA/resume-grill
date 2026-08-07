'use client'

import type { Mode } from '@/types'

type WorkspaceHeaderProps = {
  mode: Mode
  onTabChange: (tab: Mode) => void
}

const TABS: { key: Mode; label: string }[] = [
  { key: 'audit', label: '能力清单' },
  { key: 'interview', label: '能力测试' },
  { key: 'report', label: '测试报告' },
  { key: 'knowledge', label: '漏洞与知识点' },
]

export function WorkspaceHeader({
  mode,
  onTabChange,
}: WorkspaceHeaderProps) {
  return (
    <>
      {/* ── 标题栏 + 模式切换 ─────────────────────────── */}
      <section className="flex items-end justify-between gap-6 mb-5">
        <div>
          <div className="text-brand text-[12px] font-bold uppercase tracking-[0.08em] mb-2">
            能力清单
          </div>
          <h1 className="m-0 text-[28px] font-bold tracking-[-0.035em]">
            提前锁定简历中最容易卡壳的细节。
          </h1>
          <p className="mt-2 text-text-tertiary text-[14px] leading-relaxed">
            通过层层深挖，帮你确认是不是真的吃透了写在纸上的经历。
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
    </>
  )
}
