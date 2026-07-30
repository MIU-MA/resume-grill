import { describe, it, expect } from 'vitest'
import { buildReport } from './report'
import type { ResumeAnalysis } from '@/domain/resume-schema'

const analysis: ResumeAnalysis = {
  candidate: '张明',
  role: '销售',
  sourceFile: 'resume.txt',
  rawText: '...',
  summary: '识别到 1 条声明',
  claims: [
    {
      content: '季度销售额提升 30%',
      title: '销售额提升 30%',
      category: 'achievement',
      role: '销售',
      sourceSection: '工作经历',
      exaggerationRisk: 'medium',
      interviewRisk: 'high',
      evidence: ['简历中提及该表述'],
      evidenceGap: ['改造前的基线数据'],
      initialQuestion: '基线是多少？',
      evaluationPoints: ['说明改造前后的量化指标'],
    },
  ],
}

describe('buildReport', () => {
  it('包含候选人与来源', () => {
    const report = buildReport(analysis)
    expect(report).toContain('候选人：张明 · 销售')
    expect(report).toContain('来源文件：resume.txt')
  })
  it('包含声明内容、缺口与类型标签', () => {
    const report = buildReport(analysis)
    expect(report).toContain('季度销售额提升 30%')
    expect(report).toContain('改造前的基线数据')
    expect(report).toContain('成果声明')
  })
  it('输出风险级别而非旧数值', () => {
    const report = buildReport(analysis)
    expect(report).toContain('面试风险：高风险')
    expect(report).toContain('可信风险：中风险')
    expect(report).not.toContain('可验证难度')
    expect(report).not.toContain('被追问概率')
  })
})
