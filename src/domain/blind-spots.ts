import type { InterviewSession } from '@/domain/interview-schema'
import type { ResumeAnalysis, ResumeClaim } from '@/domain/resume-schema'

export type BlindSpot = {
  id: string
  claim: ResumeClaim
  annotation: string
  question: string
  explanation: string
}

export function deriveBlindSpots(
  analysis: ResumeAnalysis,
  sessions: Record<string, InterviewSession[]>,
): BlindSpot[] {
  const spots = new Map<string, BlindSpot>()
  for (const claim of analysis.claims) {
    for (const session of sessions[claim.id] ?? []) {
      for (const round of session.rounds) {
        const annotation = round.annotation?.trim()
        if (!annotation) continue
        const id = createBlindSpotId(claim.id, annotation)
        spots.set(id, {
          id,
          claim,
          annotation,
          question: round.question,
          explanation: round.evaluation.answerSuggestion?.trim() ?? '',
        })
      }
    }
  }
  return [...spots.values()]
}

export function createBlindSpotId(claimId: string, annotation: string): string {
  const value = `${claimId}\n${annotation.replace(/\s+/g, '').toLowerCase()}`
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `blind-spot-${(hash >>> 0).toString(36)}`
}
