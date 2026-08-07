'use client'

import type { ReactNode } from 'react'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import { Toast } from '@/components/ui/Toast'
import { WorkspaceTopBar } from '@/components/workspace/WorkspaceTopBar'
import type { LlmMode } from '@/hooks/use-llm-status'

type WorkspaceShellProps = {
  analysis: ResumeAnalysis
  llmMode: LlmMode | null
  envConfigured: boolean
  clientConfigured: boolean
  toast: string
  children: ReactNode
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
  onClientChanged,
  onExport,
  onExportJson,
  onLogoClick,
  onDismissToast,
}: WorkspaceShellProps) {
  return (
    <div className="min-h-screen bg-bg">
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

      <div className="w-[min(1440px,calc(100%-48px))] mx-auto mt-6 mb-10">
        {children}
      </div>
    </div>
  )
}
