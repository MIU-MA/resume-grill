'use client'

import { ExtractedTextReview } from '@/components/ExtractedTextReview'
import { ResumeUploader } from '@/components/ResumeUploader'
import { WorkspaceHeader } from '@/components/WorkspaceHeader'
import { WorkspaceShell } from '@/components/WorkspaceShell'
import { WorkspaceView } from '@/components/WorkspaceView'
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
        <ExtractedTextReview
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
      <ResumeUploader
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
      <WorkspaceView
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
