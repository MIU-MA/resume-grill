'use client'

import type { ReactNode } from 'react'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import { Toast } from '@/components/ui/Toast'
import { WorkspaceTopBar } from '@/components/workspace/WorkspaceTopBar'
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader'
import type { LlmMode } from '@/hooks/use-llm-status'
import type { Mode } from '@/types'

type WorkspaceShellProps = {
  analysis: ResumeAnalysis
  llmMode: LlmMode | null
  envConfigured: boolean
  clientConfigured: boolean
  toast: string
  children: ReactNode
  mode: Mode
  onTabChange: (tab: Mode) => void
  onClientChanged: () => void
  onExport: () => void
  onExportJson: () => void
  onLogoClick: () => void
  onDismissToast: () => void
}

export function WorkspaceShell({
  analysis,
  llmMode,
  envConfigured,
  clientConfigured,
  toast,
  children,
  mode,
  onTabChange,
  onClientChanged,
  onExport,
  onExportJson,
  onLogoClick,
  onDismissToast,
}: WorkspaceShellProps) {
  return (
    <div className="grid h-dvh grid-rows-[60px_44px_minmax(0,1fr)] overflow-hidden bg-bg">
      <Toast message={toast} onDismiss={onDismissToast} />

      <WorkspaceTopBar
        analysis={analysis}
        llmMode={llmMode}
        envConfigured={envConfigured}
        clientConfigured={clientConfigured}
        onClientChanged={onClientChanged}
        onExport={onExport}
        onExportJson={onExportJson}
        onLogoClick={onLogoClick}
      />

      <WorkspaceHeader mode={mode} onTabChange={onTabChange} />

      <main className="min-h-0 overflow-hidden">
        <div className="mx-auto h-full w-[min(1440px,calc(100%-48px))]">
          {children}
        </div>
      </main>
    </div>
  )
}