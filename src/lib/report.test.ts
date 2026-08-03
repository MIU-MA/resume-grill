import { describe, it, expect } from 'vitest'
import { buildFullReport, buildReport } from './report'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { createBlindSpotId } from './blind-spots'

const analysis: ResumeAnalysis = {
  candidate: '张明',
  role: '销售',
  sourceFile: 'resume.txt',
  rawText: '...',
  summary: '识别到 1 条声明',
  claims: [
    {
      id: 'claim-1-sales',
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

  it('exports annotated blind spots and their mastered status', () => {
    const claim = analysis.claims[0]
    const session: InterviewSession = {
      id: `${claim.id}:v1`, claimContent: claim.content, claimAnalysis: null, finalResult: null, status: 'done', version: 1,
      rounds: [{
        question: '基线是什么意思？', answer: '', annotation: '不理解基线', nextReason: '解释术语',
        evaluation: { score: 0, coveredPoints: [], missingPoints: claim.evaluationPoints, answerSuggestion: '基线是改进前用于比较的数据。' },
      }],
    }
    const id = createBlindSpotId(claim.id, '不理解基线')
    const report = buildFullReport(analysis, { [claim.id]: [session] }, [id])
    expect(report).toContain('已掌握：不理解基线')
    expect(report).toContain('基线是改进前用于比较的数据')
  })
})
