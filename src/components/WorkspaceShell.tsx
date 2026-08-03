'use client'

import type { ReactNode } from 'react'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import { Toast } from '@/components/Toast'
import { Topbar } from '@/components/Topbar'

type LlmMode = { label: string; cls: 'local' | 'env' | 'mock' } | null

type WorkspaceShellProps = {
  analysis: ResumeAnalysis
  llmMode: LlmMode
  envConfigured: boolean
  clientConfigured: boolean
  toast: string
  children: ReactNode
  onClientChanged: () => void
  onRerun: () => void
  onExport: () => void
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
  onRerun,
  onExport,
  onLogoClick,
  onDismissToast,
}: WorkspaceShellProps) {
  return (
    <div className="min-h-screen bg-bg">
      <Toast message={toast} onDismiss={onDismissToast} />

      <Topbar
        analysis={analysis}
        llmMode={llmMode}
        envConfigured={envConfigured}
        clientConfigured={clientConfigured}
        onClientChanged={onClientChanged}
        onRerun={onRerun}
        onExport={onExport}
        onLogoClick={onLogoClick}
      />

      <div className="w-[min(1440px,calc(100%-48px))] mx-auto mt-6 mb-10">
        {children}
      </div>
    </div>
  )
}
