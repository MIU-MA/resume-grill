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
}> = [
  { value: 'overall', label: '全面检查', description: '平衡项目、技能、成果与职责' },
  { value: 'project', label: '项目深挖', description: '优先检查项目决策和个人贡献' },
  { value: 'skills', label: '技能真实性', description: '优先验证技能深度和使用边界' },
  { value: 'achievement', label: '成果与数据', description: '优先追问指标口径和结果归因' },
  { value: 'leadership', label: '管理与协作', description: '优先检查职责边界和关键决策' },
]

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
