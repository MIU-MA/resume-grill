'use client'

import { useSettingsDialog } from '@/features/settings/hooks/use-settings-dialog'

import type { ReactNode } from 'react'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import type { Mode } from '@/application/types'
import type { LlmMode } from '@/features/settings/hooks/use-llm-status'
import type { SidebarBadges } from './WorkspaceSidebar'
import { WorkspaceTopBar } from './WorkspaceTopBar'
import { AppShell } from './AppShell'

type Props = {
  analysis: ResumeAnalysis
  llmMode: LlmMode | null
  envConfigured: boolean
  clientConfigured: boolean
  children: ReactNode
  mode: Mode
  badges: SidebarBadges
  onTabChange: (tab: Mode) => void
  onClientChanged: () => void
  onExport: () => void
  onExportJson: () => void
  onHome: () => void
}

export function WorkspaceShell(props: Props) {
  const settingsDialog = useSettingsDialog()
  return <AppShell
    mode={props.mode}
    badges={props.badges}
    onNavigate={props.onTabChange}
    onOpenHistory={props.onHome}
    {...settingsDialog}
    settings={{ envConfigured: props.envConfigured, clientConfigured: props.clientConfigured, onClientChanged: props.onClientChanged }}
    header={<div className="flex min-w-0 flex-1 items-center justify-between gap-4"><WorkspaceTopBar analysis={props.analysis} llmMode={props.llmMode} onExport={props.onExport} onExportJson={props.onExportJson} /></div>}
  >
    {props.children}
  </AppShell>
}
