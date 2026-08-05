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
      capability: '销售业绩达成能力',
      masteryPoints: [
        { point: '说明改造前后的量化指标', dimension: 'context', importance: 'high' },
        { point: '区分个人与团队贡献', dimension: 'decision', importance: 'high' },
      ],
      initialQuestion: '基线是多少？',
      initialIntent: '',
      trapPoints: ['只提结果不提过程'],
      testPriority: 'high',
    },
  ],
}

describe('buildReport', () => {
  it('包含候选人与来源', () => {
    const report = buildReport(analysis)
    expect(report).toContain('候选人：张明 · 销售')
    expect(report).toContain('来源文件：resume.txt')
  })
  it('包含声明内容、核心能力与类型标签', () => {
    const report = buildReport(analysis)
    expect(report).toContain('季度销售额提升 30%')
    expect(report).toContain('核心能力：销售业绩达成能力')
    expect(report).toContain('成果声明')
  })
  it('输出测试优先级', () => {
    const report = buildReport(analysis)
    expect(report).toContain('测试优先级：优先测试')
    expect(report).not.toContain('面试风险')
    expect(report).not.toContain('被追问概率')
  })

  it('exports annotated blind spots and their mastered status', () => {
    const claim = analysis.claims[0]
    const allPoints = claim.masteryPoints.map((mp) => mp.point)
    const session: InterviewSession = {
      id: `${claim.id}:v1`, claimContent: claim.content, claimAnalysis: null, finalResult: null, status: 'done', version: 1,
      rounds: [{
        action: 'clarify', question: '基线是什么意思？', answer: '', annotation: '不理解基线', nextReason: '解释术语',
        evaluation: { score: 0, coveredPoints: [], missingPoints: allPoints, answerSuggestion: '基线是改进前用于比较的数据。' },
      }],
    }
    const id = createBlindSpotId(claim.id, '不理解基线')
    const report = buildFullReport(analysis, { [claim.id]: [session] }, [id])
    expect(report).toContain('已掌握：不理解基线')
    expect(report).toContain('基线是改进前用于比较的数据')
  })

  it('exports skipped questions without treating them as answers', () => {
    const claim = analysis.claims[0]
    const allPoints = claim.masteryPoints.map((mp) => mp.point)
    const session: InterviewSession = {
      id: `${claim.id}:v1`, claimContent: claim.content, claimAnalysis: null,
      finalResult: {
        masteryScore: 0, canExplain: [], cannotExplain: [],
        knowledgeGaps: [], rewriteSuggestion: '', answerSummary: '', nextAction: '',
      },
      status: 'done', version: 1,
      rounds: [{
        action: 'skip', question: '基线是多少？', answer: '', annotation: '', nextReason: '转向下一点',
        evaluation: { score: 0, coveredPoints: [], missingPoints: allPoints, answerSuggestion: '' },
      }],
    }
    const report = buildFullReport(analysis, { [claim.id]: [session] })
    expect(report).toContain('有效回答轮数：0')
    expect(report).toContain('用户主动跳过（未验证）：基线是多少？')
  })
})
