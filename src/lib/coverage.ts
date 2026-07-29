// 覆盖要点交集校验：coveredPoints 只允许取自该声明的 evaluationPoints，
// 丢弃模型伪造的额外项，missing 由 evaluationPoints 减去 covered 重新推导，
// 因此覆盖率不可能超过 100%。在 /api/interview 的 LLM 分支调用。
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
