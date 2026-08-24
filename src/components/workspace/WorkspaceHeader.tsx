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

export function WorkspaceHeader({ mode, onTabChange }: WorkspaceHeaderProps) {
  return (
    <nav
      className="flex h-[44px] flex-none items-stretch gap-0.5 border-b border-line bg-bg px-7 max-md:px-4 overflow-x-auto"
      role="tablist"
      aria-label="工作区页面"
    >
      {TABS.map(({ key, label }) => {
        const isActive = mode === key
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(key)}
            className={`relative flex-none bg-transparent px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${
              isActive
                ? 'text-brand after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:rounded-full after:bg-brand'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {label}
          </button>
        )
      })}
    </nav>
  )
}