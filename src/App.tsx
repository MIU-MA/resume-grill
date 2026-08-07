'use client'

import { useEffect, useRef } from 'react'
import { ResumeReviewView } from '@/components/resume/ResumeReviewView'
import { ResumeImportView } from '@/components/resume/ResumeImportView'
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WorkspaceContent } from '@/components/workspace/WorkspaceContent'
import { useAppNavigation } from '@/hooks/use-app-navigation'
import { useClaimActions } from '@/hooks/use-claim-actions'
import { useInterview } from '@/hooks/use-interview'
import { useResumeAnalysis } from '@/hooks/use-resume-analysis'
import { useResumeWorkspace } from '@/hooks/use-resume-workspace'
import type { Mode } from '@/types'

function App() {
  const { phase, mode, push, replace } = useAppNavigation()
  const workspace = useResumeWorkspace(phase)
  const interview = useInterview(workspace.envConfigured, {
    onError: workspace.setError,
    onToast: workspace.showToast,
    onSessionSaved: workspace.handleSessionSaved,
  })
  const navigation = { push, replace }
  const analysis = useResumeAnalysis(workspace, navigation)
  const actions = useClaimActions(workspace, interview, navigation)
  const { selected, stats, completedClaimCount } = workspace

  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    if (!workspace.recoveredFromStorage) return
    if (mode !== 'interview' || !selected || interview.rounds.length > 0) return
    if (interview.loading) return
    const claimSessions = workspace.sessions[selected.id] ?? []
    const inProgress = claimSessions
      .filter((s) => s.status === 'in_progress')
      .sort((a, b) => b.version - a.version)[0]
    if (inProgress && interview.restore(selected, inProgress)) {
      restoredRef.current = true
    }
  }, [workspace.recoveredFromStorage, mode, selected, workspace.sessions, interview])

  const activeClaim = interview.activeClaimSnapshot ?? selected

  const handleTabChange = (tab: Mode) => {
    if (tab === mode) return

    if (tab === 'interview') {
      if (!selected) return

      const hasActiveInterview =
        interview.activeClaimSnapshot?.id === selected.id &&
        !interview.done &&
        Boolean(interview.currentQuestion)

      if (hasActiveInterview) {
        replace('workspace', 'interview')
        window.scrollTo({ top: 0, left: 0 })
        return
      }

      const inProgressSession = (workspace.sessions[selected.id] ?? [])
        .filter((session) => session.status === 'in_progress')
        .sort((a, b) => b.version - a.version)[0]

      if (inProgressSession) {
        interview.reset()

        const restored = interview.restore(
          selected,
          inProgressSession,
        )

        if (restored) {
          restoredRef.current = true

          replace('workspace', 'interview')
          window.scrollTo({ top: 0, left: 0 })
          return
        }
      }

      void actions.startInterview()
      return
    }

    replace('workspace', tab)

    if (tab === 'audit') {
      interview.reset()
    }

    window.scrollTo({ top: 0, left: 0 })
  }

  if (workspace.recovering) return <div className="min-h-screen bg-bg" />

  if (phase === 'upload' || !workspace.analysis || !selected || !stats) {
    if (phase === 'review' && workspace.pendingExtracted) {
      return (
        <ResumeReviewView
          sourceFile={workspace.pendingExtracted.sourceFile}
          extracted={workspace.pendingExtracted.extracted}
          analyzing={analysis.analyzing}
          error={workspace.error}
          envConfigured={workspace.envConfigured}
          clientConfigured={workspace.clientConfigured}
          onClientChanged={workspace.refreshClientLlm}
          onConfirm={analysis.handleConfirmText}
          onBack={analysis.replaceResume}
        />
      )
    }
    return (
      <ResumeImportView
        analyzing={analysis.analyzing}
        error={workspace.error}
        onExtracted={analysis.handleExtracted}
        envConfigured={workspace.envConfigured}
        clientConfigured={workspace.clientConfigured}
        onClientChanged={workspace.refreshClientLlm}
        savedRecords={workspace.savedRecords}
        loadingRecords={workspace.loadingRecords}
        onOpenSaved={analysis.openSavedRecord}
        onDeleteSaved={analysis.removeSavedRecord}
      />
    )
  }

  return (
    <WorkspaceShell
      analysis={workspace.analysis}
      llmMode={workspace.llmMode}
      envConfigured={workspace.envConfigured}
      clientConfigured={workspace.clientConfigured}
      toast={workspace.toast}
      onClientChanged={workspace.refreshClientLlm}
      onExport={actions.exportFull}
      onExportJson={actions.exportJson}
      onLogoClick={analysis.replaceResume}
      onDismissToast={() => workspace.setToast('')}
    >
      <WorkspaceHeader
        mode={mode}
        highCount={stats.highCount}
        totalMasteryPoints={stats.totalMasteryPoints}
        claimCount={stats.claimCount}
        completedClaimCount={completedClaimCount}
        coveredLength={interview.covered.length}
        onTabChange={handleTabChange}
      />
      <WorkspaceContent
        mode={mode}
        analysis={workspace.analysis}
        sessions={workspace.sessions}
        selectedIndex={workspace.selectedIndex}
        selected={selected}
        activeClaim={activeClaim!}
        preparedClaimIds={workspace.preparedClaimIds}
        masteredBlindSpotIds={workspace.masteredBlindSpotIds}
        error={workspace.error}
        iv={interview}
        onSelect={actions.selectClaim}
        onTogglePrepared={actions.togglePrepared}
        onToggleBlindSpot={actions.toggleBlindSpotMastered}
        onStartInterview={actions.startInterview}
        onReport={actions.goReport}
        onRetest={actions.retestClaim}
        onRewrite={actions.startRewriteInterview}
        onRegenerateSummary={interview.regenerateSummary}
        onFinish={() => {
          if (interview.done) {
            actions.goReport()
            interview.reset()
          }
        }}
        onBackToAudit={() => {
          replace('workspace', 'audit')
          interview.reset()
        }}
      />
    </WorkspaceShell>
  )
}

export default App
