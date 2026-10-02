import { describe, expect, it } from 'vitest'
import { newRecordId, resumeContentKey } from './storage'
import { reviewedCandidatesKey } from '@/domain/analysis-config'
import type { ResumeAnalysis } from '@/domain/resume-schema'

describe('resumeContentKey', () => {
  it('treats whitespace-only differences as the same resume', () => {
    expect(resumeContentKey('张三\n\n产品经理')).toBe(resumeContentKey(' 张三  产品经理 '))
  })

  it('changes when resume content changes', () => {
    expect(resumeContentKey('张三 产品经理')).not.toBe(resumeContentKey('张三 运营经理'))
  })
})

describe('reviewedCandidatesKey', () => {
  it('ignores incomplete legacy candidate records', () => {
    expect(reviewedCandidatesKey([null, {}, { content: undefined }, { content: '负责客户续约' }])).toContain('负责客户续约')
  })
})

describe('newRecordId', () => {
  const input: Pick<ResumeAnalysis, 'rawText' | 'jobDescription' | 'jobContext' | 'analysisGoal' | 'reviewedCandidates'> = {
    rawText: '张三\n项目经历\n负责订单系统前端开发',
    jobDescription: '负责 React 前端开发',
    analysisGoal: 'overall',
    reviewedCandidates: [{ content: '负责订单系统前端开发', sourceSection: '项目经历', lineNumber: 3 }],
    jobContext: {
      applicationId: 'job-a', company: '甲公司', role: '前端工程师', sourceUrl: 'https://example.com/jobs/1',
      resumeVersion: 'sha256-first-file', resumeDocumentId: 'source-resume', resumeUpdatedAt: 1000,
    },
  }

  it('preserves the existing key for resumes without a target job', () => {
    const legacy = `resume-grill:resume:${resumeContentKey(input.rawText)}`
    expect(newRecordId({ rawText: input.rawText })).toBe(legacy)
    expect(newRecordId({ rawText: input.rawText, jobDescription: '   ' })).toBe(legacy)
    expect(newRecordId({ rawText: ` ${input.rawText.replaceAll('\n', ' ')} ` })).toBe(legacy)
  })

  it('separates general resume practice and practice with different pasted requirements', () => {
    const keys = [
      newRecordId({ rawText: input.rawText }),
      newRecordId({ rawText: input.rawText, jobDescription: '负责 React 开发' }),
      newRecordId({ rawText: input.rawText, jobDescription: '负责 Vue 开发' }),
      newRecordId(input),
    ]
    expect(new Set(keys).size).toBe(keys.length)
  })

  it.each([
    ['application', { applicationId: 'job-b' }],
    ['company', { company: '乙公司' }],
    ['role', { role: '高级前端工程师' }],
    ['source', { sourceUrl: 'https://example.com/jobs/2' }],
    ['attachment bytes', { resumeVersion: 'sha256-second-file' }],
  ])('does not overwrite prior practice when %s changes', (_name, changes) => {
    expect(newRecordId({ ...input, jobContext: { ...input.jobContext!, ...changes } })).not.toBe(newRecordId(input))
  })

  it('separates edited requirements, resume text, practice goals, and candidate selections', () => {
    const variants = [
      input,
      { ...input, jobDescription: '负责 Vue 开发' },
      { ...input, rawText: `${input.rawText}\n另一个项目` },
      { ...input, analysisGoal: 'skills' as const },
      { ...input, reviewedCandidates: [{ content: '掌握 TypeScript', sourceSection: '技术技能', lineNumber: 5 }] },
    ]
    expect(new Set(variants.map(newRecordId)).size).toBe(variants.length)
  })

  it('reuses a job record after library timestamps change without changing its actual file', () => {
    expect(newRecordId({ ...input, jobContext: { ...input.jobContext!, resumeUpdatedAt: 2000, resumeDocumentId: 'reimported-source' } })).toBe(newRecordId(input))
  })
})
