import { describe, expect, it } from 'vitest'
import { groundedAssessments, type JobAssessment, type MatchingJob } from './job-assistant'

const resume = '使用 React 开发管理后台'
const job: MatchingJob = { id: 'one', company: '示例公司', role: '前端工程师', url: 'https://example.com/jobs/1', description: '熟悉 React，工作地点：杭州' }
const assessment: JobAssessment = { id: 'one', verdict: 'match', summary: '有 React 实践', checks: [{ requirement: 'React', status: 'supported', jobQuote: '熟悉 React', resumeQuote: '使用 React 开发管理后台' }] }

describe('岗位判断的原文依据', () => {
  it('接受真实引用，城市意向不强求简历也写了城市', () => {
    const results = [{ ...assessment, checks: [...assessment.checks, { requirement: '杭州', status: 'fits_goal' as const, jobQuote: '工作地点：杭州', resumeQuote: '' }] }]
    expect(groundedAssessments(resume, [job]).parse({ results }).results[0].verdict).toBe('match')
  })
  it('拒绝编造、拼接以及缺失的引用', () => {
    for (const patch of [{ jobQuote: '精通 React' }, { resumeQuote: '提升性能 50%' }, { resumeQuote: '' }, { jobQuote: '熟悉工作地点' }]) {
      expect(groundedAssessments(resume, [job]).safeParse({ results: [{ ...assessment, checks: [{ ...assessment.checks[0], ...patch }] }] }).success).toBe(false)
    }
  })
  it('拒绝重复、未知或漏掉的岗位', () => {
    const schema = groundedAssessments(resume, [job, { ...job, id: 'two' }])
    for (const results of [[assessment], [assessment, assessment], [assessment, { ...assessment, id: 'invented' }]]) expect(schema.safeParse({ results }).success).toBe(false)
  })
  it('职责缺失、条件未知或明确冲突时不能直接推荐', () => {
    expect(groundedAssessments(resume, [{ ...job, description: '' }]).parse({ results: [{ ...assessment, checks: [{ ...assessment.checks[0], jobQuote: '前端工程师' }] }] }).results[0].verdict).toBe('review')
    for (const status of ['unknown', 'conflict'] as const) {
      const result = groundedAssessments(resume, [job]).parse({ results: [{ ...assessment, checks: [...assessment.checks, { requirement: '城市', status, jobQuote: '工作地点：杭州', resumeQuote: '' }] }] })
      expect(result.results[0].verdict).toBe('review')
    }
  })
})
