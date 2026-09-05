import { extractResumeClaimCandidates } from '@/lib/resume-structure'
import type { ReviewCandidate } from '@/features/resume/resume-review-types'

export function createReviewCandidates(text: string): ReviewCandidate[] {
  return extractResumeClaimCandidates(text).map((candidate, index) => ({
    ...candidate,
    id: `candidate-${candidate.lineNumber}-${index}`,
    enabled: true,
  }))
}

export function groupCandidates(
  candidates: ReviewCandidate[],
): Array<[string, ReviewCandidate[]]> {
  const groups = new Map<string, ReviewCandidate[]>()
  candidates.forEach((candidate) => {
    const current = groups.get(candidate.sourceSection) ?? []
    current.push(candidate)
    groups.set(candidate.sourceSection, current)
  })
  return [...groups.entries()]
}

export function isSkillSection(sourceSection: string): boolean {
  return /技能|技术|能力|skills?|competenc/i.test(sourceSection)
}
