'use client'

import { useSettingsDialog } from '@/features/settings/hooks/use-settings-dialog'

import type { ReactNode } from 'react'
import type { Mode } from '@/application/types'
import type { SidebarBadges } from '@/features/workspace/WorkspaceSidebar'
import { AppShell } from '@/features/workspace/AppShell'

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
  const settingsDialog = useSettingsDialog()
  return <AppShell
    mode="diagnosis"
    badges={badges}
    onNavigate={onNavigate}
    onOpenHistory={onHome}
    {...settingsDialog}
    settings={{ envConfigured, clientConfigured, onClientChanged }}
    headerless
  >
    {children}
  </AppShell>
}
