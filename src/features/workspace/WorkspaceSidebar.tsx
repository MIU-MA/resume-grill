'use client'

import { useId, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import {
  History,
  Lightbulb,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  FileSearch,
  Mail,
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
  { key: 'applications', label: '邮箱投递', icon: Mail },
  { key: 'diagnosis', label: '简历检查', icon: FileSearch },
  { key: 'audit', label: '面试练习', icon: ListChecks },
  { key: 'knowledge', label: '待复习', icon: Lightbulb },
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
  const compact = useSyncExternalStore(subscribeCompact, getCompactSnapshot, () => false)
  const iconOnly = isDock && (collapsed || compact)

  const handleNavigate = (tab: Mode) => {
    onNavigate(tab)
    if (!isDock) onClose?.()
  }

  const content = <>
    <div className={`workspace-brand flex h-14 flex-none items-center gap-2.5 border-b border-line ${iconOnly ? 'justify-center px-2' : 'px-4'}`}>
      <button type="button" onClick={onOpenHistory} className="flex size-7 flex-none items-center justify-center" aria-label="打开简历库">
        <img src="/favicon.svg" alt="" className="size-6" />
      </button>
      {!iconOnly && <div className="workspace-nav-label flex min-w-0 flex-col"><strong className="truncate text-[14px] font-bold">Resume Grill</strong><span className="truncate text-[11px] text-text-tertiary">求职工作台</span></div>}
    </div>
    <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3" aria-label="工作区页面">
      <div className="space-y-0.5">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const active = mode === key || (key === 'audit' && (mode === 'interview' || mode === 'report'))
          const badge = renderBadge(key, badges)
          return <SidebarButton key={key} label={label} iconOnly={iconOnly} active={active} onClick={() => handleNavigate(key)}>
            {active && <span aria-hidden="true" className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-brand" />}
            <Icon size={16} className="flex-none" aria-hidden="true" />
            {!iconOnly && <span className="workspace-nav-label min-w-0 truncate">{label}</span>}
            {!iconOnly && badge && <span className="workspace-nav-label ml-auto">{badge}</span>}
          </SidebarButton>
        })}
      </div>
    </nav>
    <div className="flex-none space-y-0.5 border-t border-line px-2 py-2">
      <SidebarButton label="简历库" iconOnly={iconOnly} onClick={onOpenHistory}>
        <History size={16} className="flex-none" aria-hidden="true" />
        {!iconOnly && <span className="workspace-nav-label">简历库</span>}
      </SidebarButton>
      <SidebarButton label={mode === 'applications' ? '邮箱设置' : '模型设置'} iconOnly={iconOnly} onClick={onOpenSettings}>
        <Settings size={16} className="flex-none" aria-hidden="true" />
        {!iconOnly && <span className="workspace-nav-label">{mode === 'applications' ? '邮箱设置' : '模型设置'}</span>}
      </SidebarButton>
      <SidebarButton label={collapsed ? '展开导航' : '收起导航'} iconOnly={iconOnly} onClick={onToggleCollapsed} className="hidden min-[1200px]:flex">
        {collapsed ? <PanelLeftOpen size={16} className="flex-none" aria-hidden="true" /> : <PanelLeftClose size={16} className="flex-none" aria-hidden="true" />}
        {!iconOnly && <span>收起导航</span>}
      </SidebarButton>
    </div>
  </>

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
          inert={!open}
        >
          {content}
        </aside>
      </>
    )
  }

  return (
    <aside
      className={`workspace-dock hidden flex-none flex-col border-r border-line bg-surface-soft transition-[width] duration-200 md:flex ${
        iconOnly ? 'w-[56px]' : 'w-[clamp(184px,8.4vw,216px)]'
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


const COMPACT_QUERY = '(min-width: 768px) and (max-width: 1199px)'
function getCompactSnapshot() { return window.matchMedia(COMPACT_QUERY).matches }
function subscribeCompact(onChange: () => void) {
  const media = window.matchMedia(COMPACT_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function SidebarButton({ label, iconOnly, active = false, onClick, className = '', children }: {
  label: string; iconOnly: boolean; active?: boolean; onClick: () => void; className?: string; children: ReactNode
}) {
  const tooltipId = useId()
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const show = (button: HTMLButtonElement) => {
    if (!iconOnly) return
    const rect = button.getBoundingClientRect()
    setPosition({ left: rect.right + 12, top: Math.max(8, Math.min(rect.top + rect.height / 2 - 17, window.innerHeight - 42)) })
  }
  useEffect(() => { setPosition(null) }, [iconOnly])
  useEffect(() => {
    if (!position) return
    const hide = () => setPosition(null)
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') hide() }
    window.addEventListener('resize', hide)
    window.addEventListener('scroll', hide, true)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', hide)
      window.removeEventListener('scroll', hide, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [position])
  return <>
    <button type="button" className={`workspace-nav-row relative flex min-h-9 w-full items-center py-2 text-[13px] font-medium ${iconOnly ? 'justify-center px-0' : 'gap-2.5 px-2.5'} ${className}`}
      aria-label={label} aria-current={active ? 'page' : undefined} aria-describedby={iconOnly && position ? tooltipId : undefined}
      onMouseEnter={event => show(event.currentTarget)} onMouseLeave={() => setPosition(null)}
      onFocus={event => show(event.currentTarget)} onBlur={() => setPosition(null)}
      onClick={() => { setPosition(null); onClick() }}>
      {children}
    </button>
    {iconOnly && position && createPortal(<span id={tooltipId} role="tooltip" className="workspace-nav-tooltip" style={position}>{label}</span>, document.body)}
  </>
}
