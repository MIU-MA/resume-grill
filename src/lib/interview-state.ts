import type { InterviewRound } from '@/domain/interview-schema'

export const MIN_INTERVIEW_ROUNDS = 3
export const MAX_INTERVIEW_ROUNDS = 5

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