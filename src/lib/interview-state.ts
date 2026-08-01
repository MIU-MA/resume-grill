import type { InterviewRound } from '@/domain/interview-schema'
import type { VerifyPoint } from '@/domain/interview-schema'

export const MIN_INTERVIEW_ROUNDS = 3
export const MAX_INTERVIEW_ROUNDS = 5

export function canonicalizeVerifyPoints(evaluationPoints: string[], modelPoints: VerifyPoint[]): VerifyPoint[] {
  return evaluationPoints.map((point, index) => {
    const normalized = normalizePoint(point)
    const match = modelPoints.find((candidate) => {
      const candidatePoint = normalizePoint(candidate.point)
      return candidatePoint === normalized || candidatePoint.includes(normalized) || normalized.includes(candidatePoint)
    })
    return {
      point,
      importance: match?.importance ?? (index === 0 ? 'high' : 'medium'),
    }
  })
}

export function mergeCoveredPoints(rounds: InterviewRound[], current: string[], allowed: string[]): string[] {
  const allowedSet = new Set(allowed)
  const covered = new Set<string>()
  for (const point of rounds.flatMap((round) => round.evaluation.coveredPoints).concat(current)) {
    if (allowedSet.has(point)) covered.add(point)
  }
  return allowed.filter((point) => covered.has(point))
}

export function shouldFinishInterview(
  roundNumber: number,
  modelWantsToFinish: boolean,
  covered: string[],
  importantPoints: string[],
): boolean {
  if (roundNumber >= MAX_INTERVIEW_ROUNDS) return true
  if (roundNumber < MIN_INTERVIEW_ROUNDS) return false
  const coveredSet = new Set(covered)
  const highPointsCovered = importantPoints.length === 0 || importantPoints.every((point) => coveredSet.has(point))
  return highPointsCovered && (modelWantsToFinish || importantPoints.length === 0)
}

function normalizePoint(value: string): string {
  return value.replace(/[\s，,。.!！?？；;：:、]/g, '').toLowerCase()
}
