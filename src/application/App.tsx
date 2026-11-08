'use client'

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { WorkspaceRoute } from '@/features/workspace/WorkspaceRoute'
import { WorkspaceRouteContext } from '@/features/workspace/workspace-route-context'
import { buildInterviewContext } from '@/domain/interview-context'
import { useAppNavigation } from '@/application/hooks/use-app-navigation'
import { useClaimActions } from '@/application/hooks/use-claim-actions'
import { useInterview } from '@/features/interview/hooks/use-interview'
import { useResumeAnalysis } from '@/application/hooks/use-resume-analysis'
import { useResumeWorkspace } from '@/application/hooks/use-resume-workspace'
import { useKnowledgeActions } from '@/features/knowledge/hooks/use-knowledge-actions'
import type { Mode } from '@/application/types'
import { effectivePriority, summarizeClaimProgress } from '@/domain/risk'
import { useConfirmation } from '@/hooks/use-confirmation'
import { Toast } from '@/components/ui/Toast'
import { getInterviewEntry } from '@/domain/interview-entry'

function WorkspaceApp({ confirm, children }: { children?: ReactNode; confirm: (request: { title: string; message: string; confirmLabel?: string }) => Promise<boolean> }) {
  const { phase, mode, push, replace } = useAppNavigation()
  const workspace = useResumeWorkspace(phase)
  const getInterviewContext = useCallback((claimId: string) => buildInterviewContext(workspace.analysis?.jobDescription, workspace.knowledgeItems, claimId, workspace.analysis?.jobContext?.interviewKind), [workspace.analysis?.jobDescription, workspace.analysis?.jobContext?.interviewKind, workspace.knowledgeItems])
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
  const { selected } = workspace
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

  return <WorkspaceRouteContext.Provider value={{ workspace, interview, analysis, actions, knowledgeActions, handleTabChange, handleToggleBlindSpot, canSwitchResume, restoredRef, sidebarBadges, claimProgress, push, replace, mode, phase }}><Toast message={workspace.toast} tone={workspace.toastTone} onDismiss={() => workspace.setToast('')} />{children ?? <WorkspaceRoute />}</WorkspaceRouteContext.Provider>
}

function App({ children }: { children?: ReactNode }) {
  const confirmation = useConfirmation()
  return <><WorkspaceApp confirm={confirmation.confirm}>{children}</WorkspaceApp>{confirmation.dialog}</>
}
export default App
