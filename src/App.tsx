'use client'

import { useEffect, useRef } from 'react'
import { ResumeReviewView } from '@/components/resume/ResumeReviewView'
import { ResumeImportView } from '@/components/resume/ResumeImportView'
import { WorkspaceHeader } from '@/components/workspace/WorkspaceHeader'
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell'
import { WorkspaceContent } from '@/components/workspace/WorkspaceContent'
import { extractResumeClaimCandidates } from '@/lib/resume-structure'
import { useAppNavigation } from '@/lib/use-app-navigation'
import { useClaimActions } from '@/lib/use-claim-actions'
import { useInterview } from '@/lib/use-interview'
import { useResumeAnalysis } from '@/lib/use-resume-analysis'
import { useResumeWorkspace } from '@/lib/use-resume-workspace'
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

  // 刷新后恢复未完成的面试
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    if (mode === 'interview' && selected && interview.rounds.length === 0 && !interview.loading) {
      const claimSessions = workspace.sessions[selected.id] ?? []
      const inProgress = claimSessions.find((s) => s.status === 'in_progress')
      if (inProgress && interview.restore(selected.id, inProgress)) {
        restoredRef.current = true
      }
    }
  }, [mode, selected, workspace.sessions, interview])

  const activeClaim =
    selected && interview.rewriteContent
      ? { ...selected, content: interview.rewriteContent }
      : selected

  const handleTabChange = (tab: Mode) => {
    replace('workspace', tab)
    if (tab === 'audit') interview.reset()
  }

  const handleRerun = () => {
    if (!workspace.analysis) return
    const a = workspace.analysis
    analysis.handleConfirmText(
      {
        rawText: a.rawText,
        analysisGoal: a.analysisGoal ?? 'overall',
        reviewedCandidates:
          a.reviewedCandidates ?? extractResumeClaimCandidates(a.rawText),
        jobDescription: a.jobDescription ?? '',
      },
      a.sourceFile,
    )
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
      onRerun={handleRerun}
      onExport={actions.exportFull}
      onExportJson={actions.exportJson}
      onLogoClick={analysis.replaceResume}
      onDismissToast={() => workspace.setToast('')}
    >
      <WorkspaceHeader
        mode={mode}
        highCount={stats.highCount}
        totalGaps={stats.totalGaps}
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
