import type { Dispatch, SetStateAction } from 'react'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import type { ExtractedText } from '@/lib/pdf'
import type { SavedRecord } from '@/lib/storage'
import type { Mode } from '@/types'

// ── 导航子集：useResumeAnalysis / useClaimActions 只用到 push/replace ──
export type AppNavigation = {
  push: (phase: 'upload' | 'review' | 'workspace', mode?: Mode) => void
  replace: (phase: 'upload' | 'review' | 'workspace', mode?: Mode) => void
}

// ── useResumeWorkspace 对外接口 ─────────────────────────────────
// 其他 hook 通过这个类型消费 workspace 的读写能力
export type UseResumeWorkspace = {
  // LLM 配置（只读）
  envConfigured: boolean
  clientConfigured: boolean
  refreshClientLlm: () => void

  // 核心状态
  analysis: ResumeAnalysis | null
  setAnalysis: Dispatch<SetStateAction<ResumeAnalysis | null>>
  pendingExtracted: { extracted: ExtractedText; sourceFile: string } | null
  setPendingExtracted: Dispatch<
    SetStateAction<{ extracted: ExtractedText; sourceFile: string } | null>
  >
  selectedIndex: number
  setSelectedIndex: Dispatch<SetStateAction<number>>
  sessions: Record<string, InterviewSession[]>
  setSessions: Dispatch<SetStateAction<Record<string, InterviewSession[]>>>
  preparedClaimIds: string[]
  setPreparedClaimIds: Dispatch<SetStateAction<string[]>>
  masteredBlindSpotIds: string[]
  setMasteredBlindSpotIds: Dispatch<SetStateAction<string[]>>
  recordId: string | null
  setRecordId: Dispatch<SetStateAction<string | null>>
  recovering: boolean
  savedRecords: SavedRecord[]
  setSavedRecords: Dispatch<SetStateAction<SavedRecord[]>>
  loadingRecords: boolean
  toast: string
  setToast: Dispatch<SetStateAction<string>>
  showToast: (m: string, d?: number) => void
  error: string | null
  setError: Dispatch<SetStateAction<string | null>>

  // 派生值
  selected: ResumeAnalysis['claims'][number] | null
  completedClaimCount: number

  // 面试持久化回调
  handleSessionSaved: (claimId: string, session: InterviewSession) => void
}
