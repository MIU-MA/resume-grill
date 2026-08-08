import type { Dispatch, SetStateAction } from 'react'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import type { ExtractedText } from '@/lib/pdf'
import type { KnowledgeItem } from '@/lib/knowledge'
import type { SavedRecord } from '@/lib/storage'
import type { Mode } from '@/types'

export type AppNavigation = {
  push: (phase: 'upload' | 'review' | 'workspace', mode?: Mode) => void
  replace: (phase: 'upload' | 'review' | 'workspace', mode?: Mode) => void
}

export type UseResumeWorkspace = {
  envConfigured: boolean
  clientConfigured: boolean
  refreshClientLlm: () => void

  analysis: ResumeAnalysis | null
  setAnalysis: Dispatch<SetStateAction<ResumeAnalysis | null>>
  pendingExtracted: { extracted: ExtractedText; sourceFile: string; demo?: boolean } | null
  setPendingExtracted: Dispatch<
    SetStateAction<{ extracted: ExtractedText; sourceFile: string; demo?: boolean } | null>
  >
  selectedIndex: number
  setSelectedIndex: Dispatch<SetStateAction<number>>
  sessions: Record<string, InterviewSession[]>
  setSessions: Dispatch<SetStateAction<Record<string, InterviewSession[]>>>
  preparedClaimIds: string[]
  setPreparedClaimIds: Dispatch<SetStateAction<string[]>>
  masteredBlindSpotIds: string[]
  setMasteredBlindSpotIds: Dispatch<SetStateAction<string[]>>
  knowledgeItems: KnowledgeItem[]
  setKnowledgeItems: Dispatch<SetStateAction<KnowledgeItem[]>>
  dismissedKnowledgeItemIds: string[]
  setDismissedKnowledgeItemIds: Dispatch<SetStateAction<string[]>>
  recordId: string | null
  setRecordId: Dispatch<SetStateAction<string | null>>
  recovering: boolean
  recoveredFromStorage: boolean
  setRecoveredFromStorage: Dispatch<SetStateAction<boolean>>
  savedRecords: SavedRecord[]
  setSavedRecords: Dispatch<SetStateAction<SavedRecord[]>>
  loadingRecords: boolean
  toast: string
  setToast: Dispatch<SetStateAction<string>>
  showToast: (m: string, d?: number) => void
  error: string | null
  setError: Dispatch<SetStateAction<string | null>>

  selected: ResumeAnalysis['claims'][number] | null
  completedClaimCount: number
  handleSessionSaved: (claimId: string, session: InterviewSession) => void
}
