'use client'

import { useState, type ReactNode } from 'react'
import type { Mode } from '@/application/types'
import type { SidebarBadges } from '@/features/workspace/WorkspaceSidebar'
import { AppShell, type SettingsTab } from '@/features/workspace/AppShell'

/** Shell for the first review pass, so it no longer swaps to a sidebar-less page. */
export function ReviewWorkspace({ children, badges, onNavigate, onHome, envConfigured, clientConfigured, onClientChanged }: {
  children: ReactNode
  badges: SidebarBadges
  onNavigate: (mode: Mode) => void
  onHome: () => void
  envConfigured: boolean
  clientConfigured: boolean
  onClientChanged: () => void
}) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('model')
  const openSettings = (tab: SettingsTab) => { setSettingsTab(tab); setSettingsOpen(true) }
  return <AppShell
    mode="diagnosis"
    badges={badges}
    onNavigate={onNavigate}
    onOpenHistory={onHome}
    settingsOpen={settingsOpen}
    settingsTab={settingsTab}
    onOpenSettings={openSettings}
    onCloseSettings={() => setSettingsOpen(false)}
    settings={{ envConfigured, clientConfigured, onClientChanged }}
    headerless
  >
    {children}
  </AppShell>
}
