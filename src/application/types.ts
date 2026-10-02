import type { Dispatch, SetStateAction } from 'react'
import type { ResumeAnalysis, TestPriority } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import type { ExtractedText } from '@/lib/pdf'
import type { KnowledgeItem } from '@/lib/knowledge'
import type { SavedRecord } from '@/lib/storage'
import type { ResumeDocument } from '@/lib/resume-library'
import type { ResumeDiagnosis } from '@/domain/resume-diagnosis'
import type { JobContext } from '@/domain/job-context'
import type { JobPreparationIntent } from '@/lib/job-preparation'
import type {
  AnalysisGoal,
  ReviewedCandidate,
} from '@/domain/analysis-config'

export type Mode = 'diagnosis' | 'audit' | 'interview' | 'report' | 'knowledge' | 'applications'

export type ResumeReviewSubmission = {
  rawText: string
  analysisGoal: AnalysisGoal
  reviewedCandidates: ReviewedCandidate[]
  candidateDrafts?: Array<ReviewedCandidate & { id: string; enabled: boolean }>
  jobDescription: string
  diagnosis?: ResumeDiagnosis
}

export type AppNavigation = {
  push: (phase: 'upload' | 'review' | 'workspace', mode?: Mode) => void
  replace: (phase: 'upload' | 'review' | 'workspace', mode?: Mode) => void
}

export type PendingResume = { extracted: ExtractedText; sourceFile: string; demo?: boolean; documentId?: string; initialReview?: ResumeReviewSubmission; autoDiagnose?: boolean; jobContext?: JobContext; preparationIntent?: JobPreparationIntent }

export type UseResumeWorkspace = {
  envConfigured: boolean
  clientConfigured: boolean
  refreshClientLlm: () => void

  analysis: ResumeAnalysis | null
  setAnalysis: Dispatch<SetStateAction<ResumeAnalysis | null>>
  pendingExtracted: PendingResume | null
  setPendingExtracted: Dispatch<
    SetStateAction<PendingResume | null>
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
  savedDocuments: ResumeDocument[]
  setSavedDocuments: Dispatch<SetStateAction<ResumeDocument[]>>
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
  claimPriorityOverrides: Record<string, TestPriority>
  setClaimPriorityOverrides: Dispatch<SetStateAction<Record<string, TestPriority>>>
  refreshSavedRecords: () => void
  handleSessionSaved: (claimId: string, session: InterviewSession) => void
}
