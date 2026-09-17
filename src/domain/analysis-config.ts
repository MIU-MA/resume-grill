import { z } from 'zod'

export const analysisGoalSchema = z.enum([
  'overall',
  'project',
  'skills',
  'achievement',
  'leadership',
])

export type AnalysisGoal = z.infer<typeof analysisGoalSchema>

export const ANALYSIS_GOALS: Array<{
  value: AnalysisGoal
  label: string
  description: string
  claimCount: number
}> = [
  { value: 'overall', label: '都练一遍', description: '项目、技能和工作经历都选一些', claimCount: 6 },
  { value: 'project', label: '项目经历', description: '怎么做的，为什么这么选，你负责哪部分', claimCount: 4 },
  { value: 'skills', label: '技术技能', description: '在哪用过，遇到过什么问题', claimCount: 4 },
  { value: 'achievement', label: '成果与数据', description: '数字怎么来的，你做了哪些改动', claimCount: 4 },
  { value: 'leadership', label: '管理与协作', description: '怎么分工，有分歧时怎么处理', claimCount: 2 },
]

export function goalClaimCount(goal: AnalysisGoal): number {
  return ANALYSIS_GOALS.find((item) => item.value === goal)?.claimCount ?? 4
}

export const reviewedCandidateSchema = z.object({
  content: z.string().trim().min(2).max(500),
  sourceSection: z.string().trim().min(1).max(80),
  lineNumber: z.number().int().positive(),
})

export type ReviewedCandidate = z.infer<typeof reviewedCandidateSchema>

export function reviewedCandidatesKey(candidates?: Array<Partial<ReviewedCandidate> | null>): string {
  return (candidates ?? [])
    .filter((candidate): candidate is Partial<ReviewedCandidate> => Boolean(candidate) && typeof candidate?.content === 'string')
    .map((candidate) => `${typeof candidate?.sourceSection === 'string' ? candidate.sourceSection : ''}\n${String(candidate?.content ?? '').replace(/\s+/g, '')}`)
    .join('\n---\n')
}
