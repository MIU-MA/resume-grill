'use client'

import { useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { WorkbenchFrame } from '@/components/layout/WorkbenchFrame'
import { SettingsDialog } from '@/features/settings/SettingsDialog'
import type { MailAgent } from '@/features/applications/hooks/use-mail-agent'
import type { MailSender, SmtpConfig } from '@/domain/mail-schema'
import type { Mode } from '@/application/types'
import { WorkspaceSidebar, type SidebarBadges } from './WorkspaceSidebar'
import { useSidebarCollapsed } from './hooks/use-sidebar-collapsed'
import { ShellContext, type ShellApi, type SettingsTab } from './app-shell-context'

export type { SettingsTab } from './app-shell-context'
export type ShellSettings = {
  envConfigured?: boolean
  clientConfigured?: boolean
  onClientChanged?: () => void
  agent?: MailAgent
  rememberedSender?: Pick<SmtpConfig, 'provider' | 'address' | 'name'>
  onVerified?: (sender: MailSender) => void
}

type AppShellProps = {
  mode: Mode | 'library'
  badges: SidebarBadges
  onNavigate: (mode: Mode) => void
  onOpenHistory: () => void
  header?: ReactNode
  headerless?: boolean
  children: ReactNode
  settingsOpen: boolean
  settingsTab: SettingsTab
  onOpenSettings: (tab: SettingsTab) => void
  onCloseSettings: () => void
  settings?: ShellSettings
  contentClassName?: string
}

/**
 * The only page chrome: one dock, one drawer, one header and one settings
 * dialog. Pages supply their title row and content; navigation never forks.
 * `headerless` lets a document page keep its own single header without
 * duplicating the shell bar.
 */
export function AppShell({ mode, badges, onNavigate, onOpenHistory, header, headerless = false, children, settingsOpen, settingsTab, onOpenSettings, onCloseSettings, settings, contentClassName }: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false)
  const [collapsed, toggleCollapsed] = useSidebarCollapsed()
  const settingsProps = settings ?? {}
  const api: ShellApi = { openSettings: tab => onOpenSettings(tab ?? 'model'), openNav: () => setNavOpen(true) }
  return <WorkbenchFrame className="flex">
    <WorkspaceSidebar
      variant="dock"
      mode={mode}
      collapsed={collapsed}
      onToggleCollapsed={toggleCollapsed}
      onNavigate={onNavigate}
      badges={badges}
      onOpenHistory={onOpenHistory}
      onOpenSettings={() => onOpenSettings('model')}
    />
    <WorkspaceSidebar
      variant="drawer"
      open={navOpen}
      mode={mode}
      collapsed={false}
      onToggleCollapsed={() => undefined}
      onNavigate={onNavigate}
      badges={badges}
      onOpenHistory={() => { onOpenHistory(); setNavOpen(false) }}
      onOpenSettings={() => { onOpenSettings('model'); setNavOpen(false) }}
      onClose={() => setNavOpen(false)}
    />
    <ShellContext.Provider value={api}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {!headerless && <header className="flex h-14 flex-none items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur-lg md:px-6">
          <button type="button" className="grid size-8 flex-none place-items-center text-text-secondary hover:bg-surface-hover md:hidden" onClick={() => setNavOpen(true)} aria-label="打开导航"><Menu size={18} /></button>
          {header}
        </header>}
        <main className={contentClassName ?? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'}>{children}</main>
      </div>
    </ShellContext.Provider>
    <SettingsDialog open={settingsOpen} onClose={onCloseSettings} initialTab={settingsTab} {...settingsProps} />
  </WorkbenchFrame>
}
