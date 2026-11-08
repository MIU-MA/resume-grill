'use client'
import { useContext } from 'react'
import dynamic from 'next/dynamic'
import type { Mode } from '@/application/types'
import { WorkspaceRouteContext } from './workspace-route-context'
import { WorkspaceLoading } from './WorkspaceLoading'
const ResumeReviewView = dynamic(() => import('@/features/resume/ResumeReviewView').then(module => module.ResumeReviewView), { loading: WorkspaceLoading })
const ResumeImportView = dynamic(() => import('@/features/resume/ResumeImportView').then(module => module.ResumeImportView), { loading: WorkspaceLoading })
import { WorkspaceShell } from '@/features/workspace/WorkspaceShell'
const WorkspaceContent = dynamic(() => import('@/features/workspace/WorkspaceContent').then(module => module.WorkspaceContent), { loading: WorkspaceLoading })
import { NoResumeWorkspace } from '@/features/workspace/NoResumeWorkspace'
import { ReviewWorkspace } from '@/features/resume/ReviewWorkspace'
const MailWorkbench = dynamic(() => import('@/features/applications/MailWorkbench').then(module => module.MailWorkbench), { loading: WorkspaceLoading })
const JobAssistant = dynamic(() => import('@/features/job-assistant/JobAssistant').then(module => module.JobAssistant), { loading: WorkspaceLoading })
const ResumeCheckWorkspace = dynamic(() => import('@/features/resume/ResumeCheckWorkspace').then(module => module.ResumeCheckWorkspace), { loading: WorkspaceLoading })
const KnowledgeView = dynamic(() => import('@/features/knowledge/KnowledgeView').then(module => module.KnowledgeView), { loading: WorkspaceLoading })
export function WorkspaceRoute(props: { mode?: Mode; phase?: 'upload' | 'review' | 'workspace' } = {}) {
  const state = useContext(WorkspaceRouteContext)
  if (!state) return <WorkspaceLoading />
  const { workspace, interview, analysis, actions, knowledgeActions, handleTabChange, handleToggleBlindSpot, canSwitchResume, restoredRef, sidebarBadges, claimProgress, push, replace } = state
  const mode = props.mode ?? state.mode, phase = props.phase ?? state.phase
  const { selected, stats } = workspace
  const activeClaim = interview.activeClaimSnapshot ?? selected
  const renderWorkspace = () => {
    if (mode === 'knowledge') return <ReviewWorkspace mode="knowledge" badges={sidebarBadges} onNavigate={handleTabChange} onHome={() => push('upload')} envConfigured={workspace.envConfigured} clientConfigured={workspace.clientConfigured} onClientChanged={workspace.refreshClientLlm}><div className="h-full overflow-auto p-4">{workspace.knowledgeReady ? <KnowledgeView analysis={workspace.analysis ?? undefined} knowledgeItems={workspace.knowledgeItems} onToggle={knowledgeActions.toggleMastered} onDelete={knowledgeActions.removeItem} onRestore={knowledgeActions.restoreItem} onUpdate={knowledgeActions.updateItem} onAdd={knowledgeActions.addItem} onRetest={actions.retestClaim} /> : <WorkspaceLoading />}</div></ReviewWorkspace>
    if (mode === 'diagnosis') return <ResumeCheckWorkspace badges={sidebarBadges} envConfigured={workspace.envConfigured} clientConfigured={workspace.clientConfigured} onClientChanged={workspace.refreshClientLlm} onHome={() => push('upload')} onNavigate={tab => workspace.analysis || ['diagnosis', 'jobs', 'applications', 'careers', 'application-history', 'knowledge'].includes(tab) ? handleTabChange(tab) : push('upload')} onPractice={async (document, review) => {
      if (!await canSwitchResume()) return
      interview.reset(); restoredRef.current = false
      await analysis.handleConfirmText(review, document.sourceFile, document)
    }} />

    if (workspace.recovering) return <WorkspaceLoading />

    if (mode === 'jobs' || mode === 'applications' || mode === 'careers' || mode === 'application-history') return <MailWorkbench mode={mode} badges={sidebarBadges} renderAssistant={tools => <JobAssistant tools={tools} envConfigured={workspace.envConfigured} />} onNavigate={tab => workspace.analysis || ['diagnosis', 'jobs', 'applications', 'careers', 'application-history', 'knowledge'].includes(tab) ? handleTabChange(tab) : push('upload')} onHome={() => push('upload')} onOpenRecord={async record => {
      if (!await canSwitchResume()) return
      interview.reset(); restoredRef.current = false; analysis.openSavedRecord(record)
    }} onPrepare={async (request, intent) => {
      if (!await canSwitchResume()) return
      await analysis.openJobPreparation(request, intent, () => {
        interview.reset()
        restoredRef.current = false
      })
    }} />

    if (phase === 'workspace' && !workspace.analysis && ['audit', 'interview', 'report', 'knowledge'].includes(mode)) {
    return <NoResumeWorkspace mode={mode} badges={sidebarBadges} onNavigate={tab => workspace.analysis || ['diagnosis', 'jobs', 'applications', 'careers', 'application-history', 'knowledge'].includes(tab) ? handleTabChange(tab) : push('upload')} onHome={() => push('upload')} />
  }

  if (phase === 'upload' || phase === 'review' || !workspace.analysis || !selected || !stats) {
      if (phase === 'review' && workspace.pendingExtracted) {
        return (
          <ReviewWorkspace badges={sidebarBadges} onNavigate={handleTabChange} onHome={() => push('upload')} envConfigured={workspace.envConfigured} clientConfigured={workspace.clientConfigured} onClientChanged={workspace.refreshClientLlm}>
          <ResumeReviewView
            embedded
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
          </ReviewWorkspace>
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
  return renderWorkspace()
}
