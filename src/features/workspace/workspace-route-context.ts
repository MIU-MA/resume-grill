'use client'
import { createContext, type RefObject } from 'react'
import type { useResumeWorkspace } from '@/application/hooks/use-resume-workspace'
import type { useResumeAnalysis } from '@/application/hooks/use-resume-analysis'
import type { useClaimActions } from '@/application/hooks/use-claim-actions'
import type { AppNavigation, Mode } from '@/application/types'
import type { useInterview } from '@/features/interview/hooks/use-interview'
import type { useKnowledgeActions } from '@/features/knowledge/hooks/use-knowledge-actions'
import type { SidebarBadges } from './WorkspaceSidebar'
import type { ClaimProgress } from '@/domain/risk'
export type WorkspaceRouteState = AppNavigation & {
  workspace: ReturnType<typeof useResumeWorkspace>
  analysis: ReturnType<typeof useResumeAnalysis>
  actions: ReturnType<typeof useClaimActions>
  interview: ReturnType<typeof useInterview>
  knowledgeActions: ReturnType<typeof useKnowledgeActions>
  handleTabChange: (mode: Mode) => void
  handleToggleBlindSpot: (id: string) => void
  canSwitchResume: () => Promise<boolean>
  restoredRef: RefObject<boolean>
  sidebarBadges: SidebarBadges
  claimProgress: Record<string, ClaimProgress>
  mode: Mode
  phase: 'upload' | 'review' | 'workspace'
}
export const WorkspaceRouteContext = createContext<WorkspaceRouteState | null>(null)
