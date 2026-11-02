'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { buildInterviewContext } from '@/domain/interview-context'
import { ResumeReviewView } from '@/features/resume/ResumeReviewView'
import { ResumeImportView } from '@/features/resume/ResumeImportView'
import { WorkspaceShell } from '@/features/workspace/WorkspaceShell'
import { WorkspaceContent } from '@/features/workspace/WorkspaceContent'
import { useAppNavigation } from '@/application/hooks/use-app-navigation'
import { useClaimActions } from '@/application/hooks/use-claim-actions'
import { useInterview } from '@/features/interview/hooks/use-interview'
import { useResumeAnalysis } from '@/application/hooks/use-resume-analysis'
import { useResumeWorkspace } from '@/application/hooks/use-resume-workspace'
import { useKnowledgeActions } from '@/application/hooks/use-knowledge-actions'
import type { Mode } from '@/application/types'
import { effectivePriority, summarizeClaimProgress } from '@/domain/risk'
import { MailWorkbench } from '@/features/applications/MailWorkbench'
import { JobAssistant } from '@/application/JobAssistant'
import { ResumeCheckWorkspace } from './ResumeCheckWorkspace'
import { useConfirmation } from '@/hooks/use-confirmation'
import { Toast } from '@/components/ui/Toast'
import { getInterviewEntry } from '@/domain/interview-entry'

function WorkspaceApp({ confirm }: { confirm: (request: { title: string; message: string; confirmLabel?: string }) => Promise<boolean> }) {
  const { phase, mode, push, replace } = useAppNavigation()
  const workspace = useResumeWorkspace(phase)
  const getInterviewContext = useCallback((claimId: string) => buildInterviewContext(workspace.analysis?.jobDescription, workspace.knowledgeItems, claimId), [workspace.analysis?.jobDescription, workspace.knowledgeItems])
  const interview = useInterview(workspace.envConfigured, {
    onError: workspace.setError,
    onToast: workspace.showToast,
    onSessionSaved: workspace.handleSessionSaved,
  }, getInterviewContext, workspace.recordId ?? 'unselected')
  const canSwitchResume = async () => {
    if (interview.loading || interview.regeneratingId) { workspace.showToast('当前回答还在处理中，完成后再切换。'); return false }
    if ((interview.answer.trim() || interview.annotation.trim()) && !interview.draftSaved) { workspace.showToast('回答草稿无法暂存，请先复制备份再切换。'); return false }
    if (interview.done || (!interview.answer.trim() && !interview.annotation.trim() && !interview.currentQuestion)) return true
    return confirm({ title: '切换当前简历？', message: interview.answer.trim() || interview.annotation.trim() ? '有未提交回答。已输入内容会暂存到当前简历与轮次，回来继续本轮时恢复；现在切换不会提交回答。' : '本次面试还没结束，记录会保留，回来可以继续。', confirmLabel: '保留草稿并切换' })
  }
  useEffect(() => {
    if (!interview.answer.trim() && !interview.annotation.trim()) return
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [interview.answer, interview.annotation])
  const navigation = { push, replace }
  const analysis = useResumeAnalysis(workspace, navigation)
  const actions = useClaimActions(workspace, interview, navigation)
  const knowledgeActions = useKnowledgeActions(workspace)
  const { selected, stats } = workspace
  useEffect(() => {
    if (phase === 'workspace' && workspace.workspaceLoaded && !workspace.recovering && (!workspace.analysis || !selected) && !['diagnosis', 'applications', 'careers', 'application-history'].includes(mode)) replace('upload')
  }, [phase, mode, workspace.workspaceLoaded, workspace.recovering, workspace.analysis, selected, replace])
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
    const latest = [...claimSessions].sort((a, b) => b.version - a.version)[0]
    const inProgress = latest?.status === 'in_progress' ? latest : undefined
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

      const entry = getInterviewEntry(selected.id, workspace.sessions[selected.id] ?? [], interview)
      if (entry.action === 'restore') {
        interview.reset()
        if (interview.restore(selected, entry.session)) restoredRef.current = true
      }
      replace('workspace', 'interview')
      window.scrollTo({ top: 0, left: 0 })
      return
    }

    replace('workspace', tab)

    window.scrollTo({ top: 0, left: 0 })
  }

  const renderWorkspace = () => {
    if (mode === 'diagnosis') return <ResumeCheckWorkspace badges={sidebarBadges} envConfigured={workspace.envConfigured} clientConfigured={workspace.clientConfigured} onClientChanged={workspace.refreshClientLlm} onHome={() => push('upload')} onNavigate={tab => workspace.analysis || ['diagnosis', 'applications', 'careers', 'application-history'].includes(tab) ? handleTabChange(tab) : push('upload')} onPractice={async (document, review) => {
      if (!await canSwitchResume()) return
      interview.reset(); restoredRef.current = false
      await analysis.handleConfirmText(review, document.sourceFile, document)
    }} />

    if (workspace.recovering) return <div className="min-h-screen bg-bg" />

    if (mode === 'applications' || mode === 'careers' || mode === 'application-history') return <MailWorkbench mode={mode} badges={sidebarBadges} renderAssistant={tools => <JobAssistant tools={tools} envConfigured={workspace.envConfigured} />} onNavigate={tab => workspace.analysis || ['diagnosis', 'applications', 'careers', 'application-history'].includes(tab) ? handleTabChange(tab) : push('upload')} onHome={() => push('upload')} onOpenRecord={async record => {
      if (!await canSwitchResume()) return
      interview.reset(); restoredRef.current = false; analysis.openSavedRecord(record)
    }} onPrepare={async (request, intent) => {
      if (!await canSwitchResume()) return
      await analysis.openJobPreparation(request, intent, () => {
        interview.reset()
        restoredRef.current = false
      })
    }} />

    if (phase === 'upload' || phase === 'review' || !workspace.analysis || !selected || !stats) {
      if (phase === 'review' && workspace.pendingExtracted) {
        return (
          <ResumeReviewView
            key={workspace.pendingExtracted.documentId ?? workspace.pendingExtracted.sourceFile + workspace.pendingExtracted.extracted.text}
            demo={workspace.pendingExtracted.demo ?? false}
            sourceFile={workspace.pendingExtracted.sourceFile}
            extracted={workspace.pendingExtracted.extracted}
            analyzing={analysis.analyzing}
            error={workspace.error}
            envConfigured={workspace.envConfigured}
            clientConfigured={workspace.clientConfigured}
            onClientChanged={workspace.refreshClientLlm}
            onConfirm={analysis.handleConfirmText}
            initialReview={workspace.pendingExtracted.initialReview}
            autoDiagnose={workspace.pendingExtracted.autoDiagnose}
            jobContext={workspace.pendingExtracted.jobContext}
            preparationIntent={workspace.pendingExtracted.preparationIntent}
            onSaveReview={analysis.saveReview}
            initialRevisionDraft={workspace.pendingExtracted.revisionDraft}
            initialPdfTemplate={workspace.pendingExtracted.pdfTemplate} initialPhoto={workspace.pendingExtracted.photo}
            onSaveRevisionDraft={analysis.saveRevisionDraft}
            onSaveRevision={async (text, preview) => {
              if (interview.loading || interview.regeneratingId) throw new Error('当前回答还在处理中，完成后可保存新稿。')
              await analysis.saveRevision(text, preview)
              interview.reset()
              restoredRef.current = false
            }}
            onDownloadResume={workspace.pendingExtracted.hasAttachment ? analysis.downloadResume : undefined}
            onLoadOriginal={workspace.pendingExtracted.hasAttachment ? analysis.loadResumeFile : undefined}
            onApplications={() => push('workspace', 'applications')}
            onBack={analysis.replaceResume}
          />
        )
      }
      return (
        <ResumeImportView
          analyzing={analysis.analyzing}
          error={workspace.error}
          onExtracted={async (...args) => { if (!await canSwitchResume()) return; interview.reset(); return analysis.handleExtracted(...args) }}
          envConfigured={workspace.envConfigured}
          clientConfigured={workspace.clientConfigured}
          onClientChanged={workspace.refreshClientLlm}
          savedDocuments={workspace.savedDocuments}
          onOpenDocument={async document => { if (!await canSwitchResume()) return; interview.reset(); restoredRef.current = false; analysis.openResumeDocument(document) }}
          onDeleteDocument={analysis.removeResumeDocument}
          savedRecords={workspace.savedRecords}
          loadingRecords={workspace.loadingRecords}
          onOpenSaved={async record => { if (!await canSwitchResume()) return; interview.reset(); restoredRef.current = false; analysis.openSavedRecord(record) }}
          onNavigate={tab => handleTabChange(tab)} badges={sidebarBadges}
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
        onHome={() => push('upload')}
        mode={mode}
        onTabChange={handleTabChange}
        onClientChanged={workspace.refreshClientLlm}
        onExport={actions.exportFull}
        onExportJson={actions.exportJson}
        badges={sidebarBadges}
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
  return <><Toast message={workspace.toast} tone={workspace.toastTone} onDismiss={() => workspace.setToast('')} />{renderWorkspace()}</>
}

function App() {
  const confirmation = useConfirmation()
  return <><WorkspaceApp confirm={confirmation.confirm} />{confirmation.dialog}</>
}
export default App
