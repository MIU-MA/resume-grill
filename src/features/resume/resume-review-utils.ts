import { isExcludedClaimContent } from '@/domain/claim-filter'
import { extractResumeClaimCandidates, type ParsedResumeSection } from '@/domain/resume-structure'
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
  sections: ParsedResumeSection[] = [],
): Array<[string, ReviewCandidate[]]> {
  const groups = new Map<string, ReviewCandidate[]>(sections.map(section => [section.title, []]))
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

export function includeReviewLine(candidates: ReviewCandidate[], section: ParsedResumeSection, lineNumber: number): ReviewCandidate[] {
  const line = section.lines.find(line => line.lineNumber === lineNumber)
  if (!line || ['general', 'profile', 'education', 'awards', 'selfReview'].includes(section.kind)) return candidates
  const content = line.text.replace(/^[-*•·●▪◦‣⁃▸►○◆◇]\s*/, '').trim()
  if (content.length < 2 || isExcludedClaimContent(content)) return candidates
  const old = candidates.find(item => item.sourceSection === section.title && item.lineNumber === lineNumber)
  if (old) return candidates.map(item => item === old ? { ...item, enabled: true } : item)
  return [...candidates, { id: `manual-${section.title}-${lineNumber}`, content, sourceSection: section.title, lineNumber, enabled: true }]
}
