'use client'

import { useEffect, useMemo, useRef } from 'react'
import { ResumeReviewView } from '@/features/resume/ResumeReviewView'
import { ResumeImportView } from '@/features/resume/ResumeImportView'
import { WorkspaceShell } from '@/features/workspace/WorkspaceShell'
import { WorkspaceContent } from '@/features/workspace/WorkspaceContent'
import { useAppNavigation } from '@/hooks/use-app-navigation'
import { useClaimActions } from '@/hooks/use-claim-actions'
import { useInterview } from '@/hooks/use-interview'
import { useResumeAnalysis } from '@/hooks/use-resume-analysis'
import { useResumeWorkspace } from '@/hooks/use-resume-workspace'
import { useKnowledgeActions } from '@/hooks/use-knowledge-actions'
import type { Mode } from '@/application/types'
import { effectivePriority, summarizeClaimProgress } from '@/lib/risk'
import { MailWorkbench } from '@/features/applications/MailWorkbench'

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
  const knowledgeActions = useKnowledgeActions(workspace)
  const { selected, stats } = workspace
  const handleToggleBlindSpot = (blindSpotId: string) => {
    actions.toggleBlindSpotMastered(blindSpotId)
    const item = workspace.knowledgeItems.find((i) => i.id === blindSpotId)
    if (item && item.source === 'blind-spot') {
      const nextStatus = item.status === 'mastered' ? 'open' : 'mastered'
      workspace.setKnowledgeItems((items) =>
        items.map((i) => (i.id === blindSpotId ? { ...i, status: nextStatus, updatedAt: Date.now() } : i)),
      )
    }
  }

  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    if (!workspace.recoveredFromStorage) return
    if (mode !== 'interview' || !selected || interview.rounds.length > 0 || interview.currentQuestion) return
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
  const claimProgress = useMemo(
    () =>
      workspace.analysis
        ? summarizeClaimProgress(
            workspace.analysis.claims,
            workspace.sessions,
            workspace.preparedClaimIds,
          )
        : {},
    [workspace.analysis, workspace.sessions, workspace.preparedClaimIds],
  )
  const sidebarBadges = useMemo(() => {
    const claims = workspace.analysis?.claims ?? []
    return {
      claimTotal: claims.length,
      highUntested: claims.filter(
        (claim) =>
          effectivePriority(claim, workspace.claimPriorityOverrides) ===
            'high' && claimProgress[claim.id]?.status === 'todo',
      ).length,
      testingActive: Object.values(workspace.sessions)
        .flat()
        .filter((session) => session.status === 'in_progress').length,
      testedDone: Object.values(claimProgress).filter(
        (progress) => progress.status === 'done',
      ).length,
      knowledgeOpen: workspace.knowledgeItems.filter(
        (item) => item.status === 'open',
      ).length,
    }
  }, [
    workspace.analysis,
    workspace.claimPriorityOverrides,
    workspace.sessions,
    workspace.knowledgeItems,
    claimProgress,
  ])

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

      replace('workspace', 'interview')
      return
    }

    replace('workspace', tab)

    window.scrollTo({ top: 0, left: 0 })
  }

  if (workspace.recovering) return <div className="min-h-screen bg-bg" />

  if (mode === 'applications') return <MailWorkbench badges={sidebarBadges} onNavigate={tab => workspace.analysis ? handleTabChange(tab) : push('upload')} onHome={() => push('upload')} />

  if (phase === 'upload' || !workspace.analysis || !selected || !stats) {
    if (phase === 'review' && workspace.pendingExtracted) {
      return (
        <ResumeReviewView
          key={workspace.pendingExtracted.sourceFile + workspace.pendingExtracted.extracted.text}
          demo={workspace.pendingExtracted.demo ?? false}
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
      mode={mode}
      onTabChange={handleTabChange}
      onClientChanged={workspace.refreshClientLlm}
      onExport={actions.exportFull}
      onExportJson={actions.exportJson}
      badges={sidebarBadges}
      savedRecords={workspace.savedRecords}
      loadingRecords={workspace.loadingRecords}
      refreshSavedRecords={workspace.refreshSavedRecords}
      onOpenSaved={(record) => {
        if (
          interview.rounds.length > 0 &&
          !interview.done &&
          !window.confirm('当前练习还没结束，确定切换简历吗？')
        ) {
          return false
        }
        analysis.openSavedRecord(record)
        return true
      }}
      onDeleteSaved={analysis.removeSavedRecord}
      onNewResume={() => {
        if (
          interview.rounds.length > 0 &&
          !interview.done &&
          !window.confirm('当前练习还没结束，确定导入新简历吗？')
        ) {
          return false
        }
        analysis.replaceResume()
        return true
      }}
      onDismissToast={() => workspace.setToast('')}
    >
      <WorkspaceContent onNavigate={handleTabChange}
        mode={mode}
        analysis={workspace.analysis}
        sessions={workspace.sessions}
        error={workspace.error}
        audit={{
          selectedIndex: workspace.selectedIndex,
          preparedClaimIds: workspace.preparedClaimIds,
          progressByClaim: claimProgress,
          claimPriorityOverrides: workspace.claimPriorityOverrides,
          onSelect: actions.selectClaim,
          onTogglePrepared: actions.togglePrepared,
          onSetClaimsPriority: actions.setClaimsPriority,
          onBatchTogglePrepared: actions.togglePreparedMany,
          onStartInterview: actions.startInterview,
          onReport: actions.goReport,
        }}
        knowledge={{
          items: workspace.knowledgeItems,
          onToggle: knowledgeActions.toggleMastered,
          onDelete: knowledgeActions.removeItem,
          onRestore: knowledgeActions.restoreItem,
          onUpdate: knowledgeActions.updateItem,
          onAdd: knowledgeActions.addItem,
          onRetest: actions.retestClaim,
        }}
        report={{
          masteredBlindSpotIds: workspace.masteredBlindSpotIds,
          onToggleBlindSpot: handleToggleBlindSpot,
          onRetest: actions.retestClaim,
          onRewrite: actions.startRewriteInterview,
          onRegenerateSummary: interview.regenerateSummary,
        }}
        interview={{
          selected,
          activeClaim: activeClaim!,
          view: interview,
          onFinish: () => {
            if (interview.done) {
              actions.goReport()
              interview.reset()
            }
          },
          onBackToAudit: () => {
            replace('workspace', 'audit')
          },
        }}
      />
    </WorkspaceShell>
  )
}

export default App
