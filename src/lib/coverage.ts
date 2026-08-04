export function sanitizeCoverage(
  rawCovered: string[],
  evaluationPoints: string[],
): { covered: string[]; missing: string[] } {
  const allowed = new Set(evaluationPoints)
  const covered: string[] = []
  const seen = new Set<string>()
  for (const p of rawCovered) {
    if (allowed.has(p) && !seen.has(p)) {
      covered.push(p)
      seen.add(p)
    }
  }
  const coveredSet = new Set(covered)
  const missing = evaluationPoints.filter((p) => !coveredSet.has(p))
  return { covered, missing }
}
