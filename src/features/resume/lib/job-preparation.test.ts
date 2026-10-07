import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResumeReviewSubmission } from '@/domain/resume-review'
import type { ExtractedText } from './pdf'

const database = vi.hoisted(() => {
  const values = new Map<string, unknown>()
  let tail = Promise.resolve()
  const transaction = <T>(operation: () => T): Promise<T> => {
    const result = tail.then(operation)
    tail = result.then(() => undefined, () => undefined)
    return result
  }
  return {
    values,
    get: vi.fn((key: string) => transaction(() => values.get(key))),
    set: vi.fn((key: string, value: unknown) => transaction(() => { values.set(key, value) })),
    del: vi.fn((key: string) => transaction(() => { values.delete(key) })),
    keys: vi.fn(() => transaction(() => [...values.keys()])),
    update: vi.fn((key: string, updater: (value: unknown) => unknown) => transaction(() => {
      values.set(key, updater(values.get(key)))
    })),
  }
})
const extraction = vi.hoisted(() => ({ extractTextFromFile: vi.fn() }))
vi.mock('idb-keyval', () => database)
vi.mock('./pdf', () => extraction)

import { prepareJobResume, type JobPreparationRequest } from './job-preparation'
import { importResumeDocument, loadResumeDocument, updateResumeDocument } from './resume-library'

const rawText = '张三\n项目经历\n负责订单系统前端开发，使用 React 实现订单管理和数据展示。'
const extracted: ExtractedText = { text: rawText, charCount: rawText.length, pageCount: 1 }
const request = (changes: Partial<JobPreparationRequest> = {}): JobPreparationRequest => ({
  job: { id: 'application-a', company: '甲公司', role: '前端工程师', sourceUrl: 'https://example.com/jobs/1', jobDescription: '使用 React 开发前端页面，负责性能优化。' },
  attachment: new File(['resume version one'], '简历.pdf', { type: 'application/pdf', lastModified: 1000 }),
  ...changes,
})
const diagnosis: NonNullable<ResumeReviewSubmission['diagnosis']> = {
  source: 'model', summary: '补充项目成果', strengths: [], issues: [], nextSteps: ['说明个人负责的部分'],
}

beforeEach(() => {
  database.values.clear()
  vi.clearAllMocks()
  extraction.extractTextFromFile.mockResolvedValue(extracted)
})

describe('prepareJobResume', () => {
  it('reopens the same job and attachment without overwriting an edited review or practice linkage', async () => {
    const input = request()
    const first = await prepareJobResume(input)
    const editedReview: ResumeReviewSubmission = {
      ...first.review!, rawText: `${rawText}\n补充项目说明`, diagnosis,
      candidateDrafts: [{ content: '补充项目说明', sourceSection: '项目经历', lineNumber: 4, id: 'edited', enabled: true }],
    }
    await updateResumeDocument(first.id, { review: editedReview, recordId: 'resume-grill:job:existing' })

    const reopened = await prepareJobResume(request())

    expect(reopened.id).toBe(first.id)
    expect(reopened.review).toEqual(editedReview)
    expect(reopened.recordId).toBe('resume-grill:job:existing')
    expect(reopened.originalFile).toBe(input.attachment)
    expect(extraction.extractTextFromFile).toHaveBeenCalledTimes(1)
  })

  it('freezes the actual file and keeps general resume diagnosis and selection independent', async () => {
    const input = request()
    const general = await importResumeDocument(extracted, input.attachment.name, false, input.attachment)
    const generalReview: ResumeReviewSubmission = { rawText, analysisGoal: 'skills', reviewedCandidates: [], jobDescription: '', diagnosis }
    await updateResumeDocument(general.id, { review: generalReview, recordId: 'general-practice' })
    input.attachmentSource = { id: general.id, updatedAt: general.originalFileUpdatedAt! }

    const prepared = await prepareJobResume(input)

    expect(prepared.id).not.toBe(general.id)
    expect(prepared.jobContext).toMatchObject({ applicationId: input.job.id, company: input.job.company, role: input.job.role, resumeDocumentId: general.id })
    expect(prepared.jobContext?.resumeVersion).toMatch(/^[a-f0-9]{64}$/)
    expect(prepared.originalFile).toBe(input.attachment)
    expect(await prepared.originalFile!.text()).toBe('resume version one')
    expect(prepared.review).toMatchObject({ rawText, jobDescription: input.job.jobDescription })
    expect(prepared.review?.diagnosis).toBeUndefined()
    expect(prepared.recordId).toBeUndefined()
    expect(await loadResumeDocument(general.id)).toMatchObject({ review: generalReview, recordId: 'general-practice' })
    expect(database.values.get('current-resume-document')).toBe(general.id)
    expect(extraction.extractTextFromFile).not.toHaveBeenCalled()
  })

  it.each([
    ['application', { id: 'application-b' }],
    ['company', { company: '乙公司' }],
    ['role', { role: '高级前端工程师' }],
    ['source', { sourceUrl: 'https://example.com/jobs/2' }],
    ['requirements', { jobDescription: '使用 Vue 开发前端页面。' }],
  ] as const)('keeps separate review snapshots when %s changes', async (_name, jobChanges) => {
    const input = request()
    const first = await prepareJobResume(input)
    await updateResumeDocument(first.id, { review: { ...first.review!, diagnosis } })

    const next = await prepareJobResume({ ...input, job: { ...input.job, ...jobChanges } })

    expect(next.id).not.toBe(first.id)
    expect(next.review?.diagnosis).toBeUndefined()
    expect((await loadResumeDocument(first.id))?.review?.diagnosis).toEqual(diagnosis)
  })

  it('separates different file bytes even if the filename and extracted text are unchanged', async () => {
    const input = request()
    const first = await prepareJobResume(input)
    const second = await prepareJobResume({ ...input, attachment: new File(['new layout, same resume text'], input.attachment.name) })

    expect(first.review?.rawText).toBe(second.review?.rawText)
    expect(second.id).not.toBe(first.id)
    expect(second.jobContext?.resumeVersion).not.toBe(first.jobContext?.resumeVersion)
    expect(await first.originalFile!.text()).toBe('resume version one')
    expect(await second.originalFile!.text()).toBe('new layout, same resume text')
  })

  it('reuses stored extraction only when the selected library file still has the same bytes', async () => {
    const input = request()
    const source = await importResumeDocument(extracted, input.attachment.name, false, input.attachment)
    const selected = { id: source.id, updatedAt: source.originalFileUpdatedAt! }
    // Re-importing identical extracted text replaces the library file at the same id.
    await importResumeDocument(extracted, input.attachment.name, false, new File(['replacement bytes'], input.attachment.name))
    const oldExtraction = { ...extracted, text: `${rawText}\n旧附件中的文字` }
    extraction.extractTextFromFile.mockResolvedValueOnce(oldExtraction)

    const prepared = await prepareJobResume({ ...input, attachmentSource: selected })

    expect(extraction.extractTextFromFile).toHaveBeenCalledWith(input.attachment)
    expect(prepared.extracted).toEqual(oldExtraction)
    expect(prepared.jobContext?.resumeDocumentId).toBeUndefined()
    expect(await prepared.originalFile!.text()).toBe('resume version one')
    expect(await (await loadResumeDocument(source.id))!.originalFile!.text()).toBe('replacement bytes')
  })

  it('can prepare the selected attachment after its source library document was deleted', async () => {
    const input = request({ attachmentSource: { id: 'resume-document:deleted', updatedAt: 100 } })
    const prepared = await prepareJobResume(input)

    expect(extraction.extractTextFromFile).toHaveBeenCalledWith(input.attachment)
    expect(prepared.review?.rawText).toBe(rawText)
    expect(prepared.jobContext?.resumeDocumentId).toBeUndefined()
  })

  it('resolves concurrent preparation of the same inputs to one saved document', async () => {
    const input = request()
    const [first, second] = await Promise.all([prepareJobResume(input), prepareJobResume(input)])

    expect(first).toEqual(second)
    expect([...database.values.keys()].filter(key => key.startsWith('resume-document:job:'))).toEqual([first.id])
  })

  it.each(['', ' '.repeat(20), '岗'.repeat(12001)])('rejects empty or oversized job requirements before extracting a file', async (jobDescription) => {
    const input = request()
    await expect(prepareJobResume({ ...input, job: { ...input.job, jobDescription } })).rejects.toThrow('岗位')
    expect(extraction.extractTextFromFile).not.toHaveBeenCalled()
    expect(database.values.size).toBe(0)
  })

  it('does not persist a preparation when extraction fails or produces no resume text', async () => {
    extraction.extractTextFromFile.mockRejectedValueOnce(new Error('文件无法解析'))
    await expect(prepareJobResume(request())).rejects.toThrow('文件无法解析')
    extraction.extractTextFromFile.mockResolvedValueOnce({ text: '   ', charCount: 3, pageCount: 1 })
    await expect(prepareJobResume(request())).rejects.toThrow('未读到简历正文')
    expect(database.values.size).toBe(0)
  })
})
