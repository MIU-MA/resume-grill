'use client'

import { useState, type ReactNode } from 'react'
import { Menu } from 'lucide-react'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import type { Mode } from '@/application/types'
import type { LlmMode } from '@/hooks/use-llm-status'
import type { SavedRecord } from '@/lib/storage'
import type { SidebarBadges } from './WorkspaceSidebar'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { WorkspaceTopBar } from './WorkspaceTopBar'
import { HistoryDialog } from '@/features/resume/HistoryDialog'
import { SettingsDialog } from '@/features/settings/SettingsDialog'
import { Toast } from '@/components/ui/Toast'

type Props = {
  analysis: ResumeAnalysis
  llmMode: LlmMode | null
  envConfigured: boolean
  clientConfigured: boolean
  toast: string
  children: ReactNode
  mode: Mode
  badges: SidebarBadges
  onTabChange: (tab: Mode) => void
  onClientChanged: () => void
  onExport: () => void
  onExportJson: () => void
  onOpenSaved: (record: SavedRecord) => boolean
  onDeleteSaved: (id: string) => Promise<void>
  onNewResume: () => boolean
  savedRecords: SavedRecord[]
  loadingRecords: boolean
  refreshSavedRecords: () => void
  onDismissToast: () => void
}

export function WorkspaceShell(props: Props) {
  const [navOpen, setNavOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [navCollapsed, setNavCollapsed] = useState(readNavCollapsed)

  const toggleCollapsed = () => {
    setNavCollapsed((value) => {
      const next = !value
      saveNavCollapsed(next)
      return next
    })
  }

  const openHistory = () => {
    props.refreshSavedRecords()
    setHistoryOpen(true)
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <Toast message={props.toast} onDismiss={props.onDismissToast} />
      <WorkspaceSidebar
        variant="dock"
        mode={props.mode}
        collapsed={navCollapsed}
        onToggleCollapsed={toggleCollapsed}
        onNavigate={props.onTabChange}
        badges={props.badges}
        onOpenHistory={openHistory}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <WorkspaceSidebar
        variant="drawer"
        open={navOpen}
        mode={props.mode}
        collapsed={false}
        onToggleCollapsed={() => undefined}
        onNavigate={props.onTabChange}
        badges={props.badges}
        onOpenHistory={() => {
          openHistory()
          setNavOpen(false)
        }}
        onOpenSettings={() => {
          setSettingsOpen(true)
          setNavOpen(false)
        }}
        onClose={() => setNavOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[56px] flex-none items-center gap-3 border-b border-line bg-white/95 px-4 backdrop-blur-lg md:px-6">
          <button
            type="button"
            className="grid size-8 flex-none place-items-center rounded-md text-text-secondary hover:bg-surface-hover md:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="打开导航"
          >
            <Menu size={18} />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
            <WorkspaceTopBar
              analysis={props.analysis}
              llmMode={props.llmMode}
              onExport={props.onExport}
              onExportJson={props.onExportJson}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-hidden">{props.children}</main>
      </div>
      <HistoryDialog
        open={historyOpen}
        records={props.savedRecords}
        loading={props.loadingRecords}
        onClose={() => setHistoryOpen(false)}
        onOpenRecord={(record) => {
          if (props.onOpenSaved(record)) setHistoryOpen(false)
        }}
        onDeleteRecord={props.onDeleteSaved}
        onNewResume={() => {
          if (props.onNewResume()) setHistoryOpen(false)
        }}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        envConfigured={props.envConfigured}
        clientConfigured={props.clientConfigured}
        onClientChanged={props.onClientChanged}
      />
    </div>
  )
}

const NAV_COLLAPSED_KEY = 'resume-grill:nav-collapsed'

function readNavCollapsed() {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(NAV_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function saveNavCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(NAV_COLLAPSED_KEY, collapsed ? '1' : '0')
  } catch {
    // 无法使用本地存储时，当前页面内的折叠状态仍然可用。
  }
}
