import type { AnalysisGoal, ReviewedCandidate } from './analysis-config'
import type { ResumeDiagnosis } from './resume-diagnosis'

export type ResumeReviewSubmission = {
  rawText: string
  analysisGoal: AnalysisGoal
  reviewedCandidates: ReviewedCandidate[]
  candidateDrafts?: Array<ReviewedCandidate & { id: string; enabled: boolean }>
  jobDescription: string
  diagnosis?: ResumeDiagnosis
}
