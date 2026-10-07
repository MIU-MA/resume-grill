import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResumeReviewSubmission } from '@/domain/resume-review'
import type { ResumeAnalysis } from '@/domain/resume-schema'

const database = vi.hoisted(() => {
  const values = new Map<string, unknown>()
  return {
    values,
    get: vi.fn(async (key: string) => values.get(key)),
    set: vi.fn(async (key: string, value: unknown) => { values.set(key, value) }),
    del: vi.fn(async (key: string) => { values.delete(key) }),
    keys: vi.fn(async () => [...values.keys()]),
    update: vi.fn(async (key: string, updater: (value: unknown) => unknown) => { values.set(key, updater(values.get(key))) }),
  }
})
vi.mock('idb-keyval', () => database)

import { listRecords, newRecordId, saveRecord, updateRecordDiagnosis, type SavedRecord } from '../../../lib/storage'

const analysis: ResumeAnalysis = {
  candidate: '张三', role: '前端工程师', sourceFile: '简历.pdf', rawText: '张三\n项目经历\n负责订单系统前端开发',
  summary: '准备项目经历', analysisGoal: 'overall', jobDescription: '负责 React 前端开发',
  jobContext: { applicationId: 'job-a', company: '甲公司', role: '前端工程师', sourceUrl: 'https://example.com/jobs/1', resumeVersion: 'first-file-version', resumeUpdatedAt: 1000 },
  reviewedCandidates: [{ content: '负责订单系统前端开发', sourceSection: '项目经历', lineNumber: 3 }],
  claims: [{ id: 'claim-frontend', content: '负责订单系统前端开发', title: '订单系统开发', category: 'responsibility', role: '前端工程师', sourceSection: '项目经历', capability: '前端项目实践', masteryPoints: [{ point: '说明个人职责', dimension: 'practice', importance: 'high' }], initialQuestion: '你负责了哪些功能？', initialIntent: '', trapPoints: [], testPriority: 'high' }],
}
const record = (overrides: Partial<ResumeAnalysis> = {}, updatedAt = 1000): SavedRecord => {
  const snapshot = { ...analysis, ...overrides }
  return { id: newRecordId(snapshot), analysis: snapshot, sessions: {}, preparedClaimIds: [], masteredBlindSpotIds: [], updatedAt }
}

beforeEach(() => {
  database.values.clear()
  vi.clearAllMocks()
  vi.stubGlobal('window', {})
})
afterEach(() => { vi.unstubAllGlobals() })

describe('job-scoped records', () => {
  it('keeps general practice, different companies, requirements, and resume versions in the library', async () => {
    const records = [
      record({ jobContext: undefined, jobDescription: '' }, 1000),
      record({}, 2000),
      record({ jobContext: { ...analysis.jobContext!, applicationId: 'job-b', company: '乙公司' } }, 3000),
      record({ jobDescription: '负责 Vue 前端开发' }, 4000),
      record({ jobContext: { ...analysis.jobContext!, resumeVersion: 'second-file-version' } }, 5000),
    ]
    await Promise.all(records.map(saveRecord))
    // Imported source documents and knowledge storage must not be treated as analyses.
    database.values.set('resume-document:job:source', { extracted: { text: analysis.rawText } })
    database.values.set('knowledge-items', [])

    const listed = await listRecords()

    expect(listed.map(item => item.id)).toEqual([...records].reverse().map(item => item.id))
    expect(listed.map(item => item.analysis.jobContext?.applicationId)).toEqual(['job-a', 'job-a', 'job-b', 'job-a', undefined])
  })

  it('deduplicates equivalent legacy records without hiding another job using the same resume text', async () => {
    const older = record({ jobContext: undefined, jobDescription: '' }, 1000)
    const newer = { ...record({ jobContext: undefined, jobDescription: '' }, 2000), id: 'resume-grill:legacy-duplicate' }
    const forJob = record({}, 3000)
    await Promise.all([older, newer, forJob].map(saveRecord))

    expect((await listRecords()).map(item => item.id)).toEqual([forJob.id, newer.id])
  })

  it('updates only the selected job diagnosis while retaining its interviews and the general report', async () => {
    const general = record({ jobContext: undefined, jobDescription: '' })
    const otherJob = record({ jobContext: { ...analysis.jobContext!, applicationId: 'job-b' } })
    const selected = record()
    selected.sessions = { 'claim-frontend': [{ id: 'claim-frontend:v1', claimContent: analysis.claims[0].content, claimAnalysis: null, finalResult: null, status: 'in_progress', version: 1, rounds: [] }] }
    selected.preparedClaimIds = ['claim-frontend']
    selected.masteredBlindSpotIds = ['blind-spot-1']
    selected.claimPriorityOverrides = { 'claim-frontend': 'low' }
    await Promise.all([general, otherJob, selected].map(saveRecord))
    const review: ResumeReviewSubmission = {
      rawText: analysis.rawText, jobDescription: analysis.jobDescription!, analysisGoal: 'overall', reviewedCandidates: analysis.reviewedCandidates!,
      diagnosis: { source: 'model', summary: '补充性能优化成果', strengths: [], issues: [], nextSteps: ['说明优化前后的指标'] },
    }

    await updateRecordDiagnosis(selected.id, review)

    expect(database.values.get(selected.id)).toEqual({ ...selected, analysis: { ...selected.analysis, diagnosis: review.diagnosis } })
    expect(database.values.get(general.id)).toEqual(general)
    expect(database.values.get(otherJob.id)).toEqual(otherJob)
    expect((await listRecords()).find(item => item.id === selected.id)?.sessions['claim-frontend']).toMatchObject([{ version: 1, status: 'in_progress' }])
  })
})
