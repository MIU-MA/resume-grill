import { describe, it, expect } from 'vitest'
import { buildFullReport, buildReport } from './report'
import type { ResumeAnalysis } from '@/domain/resume-schema'
import type { InterviewSession } from '@/domain/interview-schema'
import { createBlindSpotId } from '../../../domain/blind-spots'

const analysis: ResumeAnalysis = {
  candidate: '张明',
  role: '销售',
  sourceFile: 'resume.txt',
  rawText: '../../../lib',
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

it('导出复盘时保留反问、目的和后续澄清提示', () => {
  const session: InterviewSession = { id: 's', claimContent: analysis.claims[0].content, rounds: [], claimAnalysis: null, status: 'done', version: 1, finalResult: {
    masteryScore: 2, masteryLevel: 'partial', canExplain: [], cannotExplain: [], knowledgeGaps: [], answerSummary: '', nextAction: '', rewriteSuggestion: '',
    interviewQuestions: [{ question: '这个岗位优先解决什么问题？', reason: '向用人经理了解目标', followUp: '确认约束再分享经历' }],
  } }
  const report = buildFullReport(analysis, { [analysis.claims[0].id]: [session] })
  expect(report).toContain('这个岗位优先解决什么问题？')
  expect(report).toContain('想了解：向用人经理了解目标')
  expect(report).toContain('听完后：确认约束再分享经历')
})

describe('buildReport', () => {
  it('包含候选人与来源', () => {
    const report = buildReport(analysis)
    expect(report).toContain('姓名：张明 · 销售')
    expect(report).toContain('来源文件：resume.txt')
  })
  it('包含简历原文、主要考察与类型标签', () => {
    const report = buildReport(analysis)
    expect(report).toContain('季度销售额提升 30%')
    expect(report).toContain('练习主题：销售业绩达成能力')
    expect(report).toContain('项目成果')
  })
  it('输出练习顺序', () => {
    const report = buildReport(analysis)
    expect(report).toContain('练习顺序：重点练习')
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
    expect(report).toContain('已学会：不理解基线')
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
    expect(report).toContain('跳过的问题：基线是多少？')
  })
})
