import { z } from 'zod'

export const DIAGNOSIS_DIMENSIONS = {
  structure: '章节与信息',
  content: '经历与成果',
  expression: '句子表达',
  relevance: '岗位要求',
} as const

export const DIAGNOSIS_PRIORITIES = { high: '先改这里', medium: '建议修改', low: '小调整' } as const

const text = (max: number) => z.string().trim().min(1).max(max)

export const diagnosisContentSchema = z.object({
  summary: text(500),
  strengths: z.array(z.object({
    title: text(60),
    evidence: text(300),
    explanation: text(300),
  })).max(4),
  issues: z.array(z.object({
    dimension: z.enum(['structure', 'content', 'expression', 'relevance']),
    priority: z.enum(['high', 'medium', 'low']),
    title: text(60),
    evidence: z.string().trim().max(300),
    problem: text(400),
    suggestion: text(500),
  })).max(8),
  nextSteps: z.array(text(200)).min(1).max(3),
})

export const resumeDiagnosisSchema = diagnosisContentSchema.extend({
  source: z.enum(['model', 'demo']),
})

export type DiagnosisContent = z.infer<typeof diagnosisContentSchema>
export type ResumeDiagnosis = z.infer<typeof resumeDiagnosisSchema>

// Validate quoted evidence independently of the model's claims about the source.
export function groundedDiagnosisSchema(rawText: string, jobDescription: string) {
  return diagnosisContentSchema.superRefine((diagnosis, ctx) => {
    diagnosis.strengths.forEach((item, index) => {
      if (!rawText.includes(item.evidence)) {
        ctx.addIssue({ code: 'custom', path: ['strengths', index, 'evidence'], message: '亮点引用必须来自简历原文' })
      }
    })
    diagnosis.issues.forEach((item, index) => {
      if (item.evidence && !rawText.includes(item.evidence)) {
        ctx.addIssue({ code: 'custom', path: ['issues', index, 'evidence'], message: '问题引用必须来自简历原文' })
      }
      if (!item.evidence && (item.dimension === 'content' || item.dimension === 'expression')) {
        ctx.addIssue({ code: 'custom', path: ['issues', index, 'evidence'], message: '内容与表达问题必须提供原文依据' })
      }
      if (item.dimension === 'relevance' && !jobDescription.trim()) {
        ctx.addIssue({ code: 'custom', path: ['issues', index, 'dimension'], message: '未提供岗位描述时不能评判岗位匹配' })
      }
    })
  })
}

export function sortDiagnosisIssues(issues: ResumeDiagnosis['issues']) {
  const order = { high: 0, medium: 1, low: 2 }
  return [...issues].sort((a, b) => order[a.priority] - order[b.priority])
}
