import type { JobMatch, JobMatchRequirement } from '@/domain/resume-schema'
import type { ReviewedCandidate } from '@/domain/analysis-config'

export function buildHeuristicJobMatch(jobDescription: string, candidates: ReviewedCandidate[]): JobMatch {
  const requirements = extractRequirements(jobDescription)
  const matches: JobMatchRequirement[] = requirements.map((requirement) => {
    const best = candidates
      .map((candidate) => ({ candidate, score: overlapScore(requirement, candidate.content) }))
      .sort((a, b) => b.score - a.score)[0]
    if (!best || best.score === 0) {
      return { requirement, match: 'gap', evidence: [], note: '简历中没有找到直接证据' }
    }
    return {
      requirement,
      match: best.score >= 2 ? 'strong' : 'partial',
      evidence: [best.candidate.content],
      note: best.score >= 2 ? '简历中有较明确的相关陈述' : '有相关提及，但还需要补充具体场景或成果',
    }
  })
  return {
    requirements: matches,
    gaps: matches.filter((item) => item.match !== 'strong').map((item) => item.requirement).slice(0, 6),
    interviewFocus: matches.filter((item) => item.match !== 'strong').map((item) => `如何证明：${item.requirement}`).slice(0, 6),
  }
}

function extractRequirements(value: string): string[] {
  return value
    .split(/\r?\n|[；;]/)
    .map((line) => line.replace(/^\s*[-*•·●▪]\s*/, '').trim())
    .filter((line) => line.length >= 4 && line.length <= 180)
    .filter((line) => !/^(岗位职责|任职要求|职位描述|job description|requirements?)$/i.test(line))
    .slice(0, 24)
}

function overlapScore(requirement: string, candidate: string): number {
  const normalizedRequirement = normalizeForMatch(requirement)
  const normalizedCandidate = normalizeForMatch(candidate)
  if (normalizedCandidate.includes(normalizedRequirement)) return 3
  const asciiTokens = requirement.toLowerCase().match(/[a-z][a-z0-9+#.-]{1,}/g) ?? []
  const chineseTokens = requirement.match(/[\u4e00-\u9fff]{2,}/g) ?? []
  const tokens = [...new Set([...asciiTokens, ...chineseTokens])]
  return tokens.filter((token) => candidate.toLowerCase().includes(token.toLowerCase())).length
}

function normalizeForMatch(value: string): string {
  return value.replace(/[\s，,。.!！?？；;：:、]/g, '').toLowerCase()
}
