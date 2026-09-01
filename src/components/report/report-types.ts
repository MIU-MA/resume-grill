import type { ResumeClaim } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'

export type ClaimReport = {
  claim: ResumeClaim
  doneSessions: InterviewSession[]
  hasInProgress: boolean
  latest: InterviewSession | null
  score: number | null
}
