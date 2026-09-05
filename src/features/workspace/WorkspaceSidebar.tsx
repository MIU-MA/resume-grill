'use client'

import {
  History,
  Lightbulb,
  ListChecks,
  MessagesSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react'
import type { Mode } from '@/application/types'

export type SidebarBadges = {
  claimTotal: number
  highUntested: number
  testingActive: number
  testedDone: number
  knowledgeOpen: number
}

type NavItem = {
  key: Mode
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { key: 'audit', label: '能力清单', icon: ListChecks },
  { key: 'interview', label: '能力测试', icon: MessagesSquare },
  { key: 'report', label: '测试报告', icon: ClipboardList },
  { key: 'knowledge', label: '漏洞与知识点', icon: Lightbulb },
]

type WorkspaceSidebarProps = {
  mode: Mode
  collapsed: boolean
  onToggleCollapsed: () => void
  onNavigate: (tab: Mode) => void
  badges: SidebarBadges
  onOpenHistory: () => void
  onOpenSettings: () => void
  variant: 'dock' | 'drawer'
  open?: boolean
  onClose?: () => void
}

export function WorkspaceSidebar({
  mode,
  collapsed,
  onToggleCollapsed,
  onNavigate,
  badges,
  onOpenHistory,
  onOpenSettings,
  variant,
  open = false,
  onClose,
}: WorkspaceSidebarProps) {
  const isDock = variant === 'dock'

  const handleNavigate = (tab: Mode) => {
    onNavigate(tab)
    if (!isDock) onClose?.()
  }

  const content = (
    <>
      {/* 品牌区 */}
      <div className={`flex h-14 flex-none items-center gap-2.5 border-b border-line px-4 ${collapsed ? 'justify-center px-0' : ''}`}>
        <button
          type="button"
          onClick={onOpenHistory}
          className="flex size-7 flex-none items-center justify-center overflow-hidden rounded-lg bg-white shadow-[0_1px_3px_rgba(16,24,40,0.05)]"
          title="打开历史简历"
        >
          <img src="/favicon.svg" alt="简历拷打机" className="size-6" />
        </button>
        {!collapsed && (
          <div className="flex min-w-0 flex-col">
            <strong className="truncate text-[14px] font-bold tracking-[-0.01em]">工作台</strong>
            <span className="text-[11px] text-text-tertiary truncate">resume-grill</span>
          </div>
        )}
      </div>

      {/* 导航区 */}
      <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="工作区页面">
        <div className={`${collapsed ? 'flex flex-col items-center gap-1' : 'space-y-0.5'}`}>
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
            const active = mode === key
            const badge = renderBadge(key, badges)
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleNavigate(key)}
                className={`group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ${
                  collapsed ? 'justify-center px-0' : ''
                } ${
                  active
                    ? 'bg-brand-soft text-brand'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                }`}
                title={collapsed ? label : undefined}
                aria-current={active ? 'page' : undefined}
              >
                {active && <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-brand" />}
                <Icon size={16} className={`flex-none ${active ? 'text-brand' : 'text-text-tertiary group-hover:text-text-secondary'}`} />
                {!collapsed && <span className="min-w-0 truncate">{label}</span>}
                {!collapsed && badge}
              </button>
            )
          })}
        </div>
      </nav>

      {/* 底部固定区 */}
      <div className="flex-none space-y-0.5 border-t border-line px-2 py-2">
        <button
          type="button"
          onClick={onOpenHistory}
          className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary ${collapsed ? 'justify-center px-0' : ''}`}
          title={collapsed ? '历史简历' : undefined}
        >
          <History size={16} className="flex-none text-text-tertiary" />
          {!collapsed && <span>历史简历</span>}
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary ${collapsed ? 'justify-center px-0' : ''}`}
          title={collapsed ? '模型设置' : undefined}
        >
          <Settings size={16} className="flex-none text-text-tertiary" />
          {!collapsed && <span>模型设置</span>}
        </button>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={`hidden w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary md:flex ${collapsed ? 'justify-center px-0' : ''}`}
          title={collapsed ? '展开导航' : '收起导航'}
        >
          {collapsed ? <PanelLeftOpen size={16} className="flex-none" /> : <PanelLeftClose size={16} className="flex-none" />}
          {!collapsed && <span>收起导航</span>}
        </button>
      </div>
    </>
  )

  if (!isDock) {
    return (
      <>
        <div
          className={`fixed inset-0 z-[45] bg-black/30 transition-opacity md:hidden ${
            open ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={onClose}
          aria-hidden="true"
        />
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-line bg-white transition-transform duration-200 md:hidden ${
            open ? 'translate-x-0' : '-translate-x-full'
          }`}
          aria-hidden={!open}
        >
          {content}
        </aside>
      </>
    )
  }

  return (
    <aside
      className={`hidden flex-none flex-col border-r border-line bg-white transition-[width] duration-200 md:flex ${
        collapsed ? 'w-[56px]' : 'w-[216px]'
      }`}
    >
      {content}
    </aside>
  )
}

function renderBadge(key: Mode, badges: SidebarBadges) {
  switch (key) {
    case 'audit':
      if (badges.highUntested > 0) {
        return <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-bold text-danger">{badges.claimTotal}</span>
      }
      return <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-surface-hover px-1.5 py-0.5 text-[10px] font-bold text-text-tertiary">{badges.claimTotal}</span>
    case 'interview':
      return badges.testingActive > 0
        ? <span className="ml-auto size-2 rounded-full bg-warning" title={`${badges.testingActive} 个进行中`} />
        : null
    case 'report':
      return <span className="ml-auto text-[11px] font-semibold text-text-tertiary">{badges.testedDone}/{badges.claimTotal}</span>
    case 'knowledge':
      return badges.knowledgeOpen > 0
        ? <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold text-warning">{badges.knowledgeOpen}</span>
        : null
    default:
      return null
  }
}
