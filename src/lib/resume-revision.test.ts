import { beforeEach, describe, expect, it, vi } from 'vitest'
import mammoth from 'mammoth'
import type { ResumeReviewSubmission } from '@/application/types'
import type { JobContext } from '@/domain/job-context'
import type { SavedRecord } from './storage'

// Model IndexedDB's serialized writes so interleaved revision saves test the
// same atomic-update boundary as the browser storage implementation.
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

vi.mock('idb-keyval', () => database)

import {
  deleteResumeDocument, importResumeDocument, listResumeAttachments, loadResumeDocument,
  resumeDocumentForRecord, saveResumeRevisionDraft, setCurrentResumeDocument, updateResumeDocument,
  type ResumeDocument,
} from './resume-library'
import { createResumeRevision } from './resume-revision'
import { newRecordId } from './storage'

const originalText = '张三\n项目经历\n负责订单系统开发，使用 React 实现订单列表。'
const revisedText = '张三\n项目经历\n负责订单系统开发，使用 React 实现订单列表，并优化首屏加载。'
const review: ResumeReviewSubmission = {
  rawText: originalText, analysisGoal: 'skills', jobDescription: '负责 React 页面开发与性能优化。',
  reviewedCandidates: [{ content: '旧的候选经历', sourceSection: '项目经历', lineNumber: 3 }],
  candidateDrafts: [{ id: 'old', content: '旧的候选经历', sourceSection: '项目经历', lineNumber: 3, enabled: true }],
  diagnosis: { source: 'model', summary: '说明具体优化措施', strengths: [], issues: [], nextSteps: [] },
}
const jobContext: JobContext = {
  applicationId: 'application-a', company: '甲公司', role: '前端工程师',
  sourceUrl: 'https://example.com/jobs/1', resumeVersion: 'old-file-hash',
  resumeDocumentId: 'resume-document:original', resumeUpdatedAt: 1000,
}

function savedRecord(changes: Partial<SavedRecord['analysis']> = {}): SavedRecord {
  return {
    id: 'resume-grill:resume:existing',
    analysis: {
      candidate: '张三', role: '前端工程师', sourceFile: '张三.pdf', rawText: originalText,
      summary: '已有练习', claims: [], analysisGoal: review.analysisGoal,
      jobDescription: review.jobDescription, diagnosis: review.diagnosis,
      reviewedCandidates: review.reviewedCandidates, ...changes,
    },
    sessions: { old: [{ id: 'session', claimContent: '旧的候选经历', rounds: [], claimAnalysis: null,
      finalResult: null, status: 'in_progress', version: 2, pendingQuestion: '请说明实现过程。' }] },
    preparedClaimIds: ['old'], masteredBlindSpotIds: ['old-point'], updatedAt: 1000,
  }
}

async function sourceDocument(): Promise<ResumeDocument> {
  const file = new File(['original PDF attachment'], '张三.pdf', { type: 'application/pdf', lastModified: 1000 })
  const imported = await importResumeDocument({ text: originalText, charCount: originalText.length, pageCount: 1 }, file.name, false, file)
  const record = savedRecord()
  database.values.set(record.id, record)
  await updateResumeDocument(imported.id, { review, recordId: record.id })
  return (await loadResumeDocument(imported.id))!
}

async function fileText(file: File): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: Buffer.from(await file.arrayBuffer()) })
  expect(result.messages).toEqual([])
  return result.value.slice(0, -2).split('\n\n').join('\n')
}

beforeEach(() => {
  database.values.clear()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('resume revision drafts', () => {
  it('stores and clears an edit independently of the reviewed text, attachment and existing practice', async () => {
    const source = await sourceDocument()
    const record = structuredClone(database.values.get(source.recordId!))
    await saveResumeRevisionDraft(source.id, { baseText: originalText, text: revisedText })
    const editing = (await loadResumeDocument(source.id))!
    expect(editing.revisionDraft).toEqual({ baseText: originalText, text: revisedText })
    expect(editing.review).toEqual(source.review)
    expect(editing.extracted).toEqual(source.extracted)
    expect(editing.originalFile).toBe(source.originalFile)
    expect(editing.recordId).toBe(source.recordId)
    await saveResumeRevisionDraft(source.id, null)
    expect((await loadResumeDocument(source.id))?.revisionDraft).toBeUndefined()
    expect(database.values.get(source.recordId!)).toEqual(record)
  })

  it('does not overwrite an existing draft when the editor has an obsolete base text', async () => {
    const source = await sourceDocument()
    await saveResumeRevisionDraft(source.id, { baseText: originalText, text: revisedText })
    await expect(saveResumeRevisionDraft(source.id, { baseText: '更早的原文', text: '过期编辑' })).rejects.toThrow('原文已在其他页面更新')
    expect((await loadResumeDocument(source.id))?.revisionDraft?.text).toBe(revisedText)
  })

  it('does not resurrect a deleted document through a delayed draft write or clear', async () => {
    const source = await sourceDocument()
    await deleteResumeDocument(source.id)
    await expect(saveResumeRevisionDraft(source.id, { baseText: originalText, text: revisedText })).rejects.toThrow('已被删除')
    await expect(saveResumeRevisionDraft(source.id, null)).rejects.toThrow('已被删除')
    expect(await loadResumeDocument(source.id)).toBeUndefined()
  })
})

describe('createResumeRevision', () => {
  it('saves a real new DOCX with matching text and fresh candidates while retaining the old review and practice', async () => {
    const source = await sourceDocument()
    const oldRecord = structuredClone(database.values.get(source.recordId!))
    await saveResumeRevisionDraft(source.id, { baseText: originalText, text: revisedText })

    const revision = await createResumeRevision(source.id, revisedText, originalText)

    expect(revision.id).not.toBe(source.id)
    expect(revision.revisionId).toBe(revision.id)
    expect(revision.revisionOf).toBe(source.id)
    expect(revision.recordId).toBeUndefined()
    expect(revision.review?.diagnosis).toBeUndefined()
    expect(revision.review?.candidateDrafts).toBeUndefined()
    expect(revision.review).toMatchObject({ rawText: revisedText, jobDescription: review.jobDescription, analysisGoal: 'skills' })
    expect(revision.review?.reviewedCandidates).toEqual([{ content: revisedText.split('\n')[2], sourceSection: '项目经历', lineNumber: 3 }])
    expect(revision.originalFile).toBeInstanceOf(File)
    expect(revision.originalFile?.name).toBe('张三-修改稿.docx')
    expect(await fileText(revision.originalFile!)).toBe(revision.extracted.text)
    expect(revision.extracted.text).toBe(revision.review?.rawText)
    expect(revision.extracted.charCount).toBe(revisedText.length)
    expect(await loadResumeDocument(revision.id)).toEqual(revision)
    const retained = (await loadResumeDocument(source.id))!
    expect(retained).toMatchObject({ review: source.review, extracted: source.extracted, recordId: source.recordId })
    expect(retained.originalFile).toBe(source.originalFile)
    expect(await retained.originalFile!.text()).toBe('original PDF attachment')
    expect(retained.revisionDraft).toBeUndefined()
    expect(database.values.get(source.recordId!)).toEqual(oldRecord)
    expect(database.values.get('current-resume-document')).toBe(source.id)
  })

  it('normalizes the persisted text and the exported attachment identically', async () => {
    const source = await sourceDocument()
    const input = '\n张三\r\n项目经历\r负责开发订单页面\u2028\u0000  使用 React & TypeScript <组件>\n'
    const revision = await createResumeRevision(source.id, input, originalText)
    const expected = '张三\n项目经历\n负责开发订单页面\n  使用 React & TypeScript <组件>'
    expect(revision.extracted.text).toBe(expected)
    expect(revision.review?.rawText).toBe(expected)
    expect(await fileText(revision.originalFile!)).toBe(expected)
  })

  it('assigns each saved revision its own practice identity even when the new text is identical', async () => {
    const source = await sourceDocument()
    const first = await createResumeRevision(source.id, revisedText, originalText)
    const second = await createResumeRevision(source.id, revisedText, originalText)
    expect(first.revisionId).not.toBe(second.revisionId)
    expect(newRecordId({ ...first.review!, revisionId: first.revisionId })).not.toBe(newRecordId({ ...second.review!, revisionId: second.revisionId }))
  })

  it('preserves the target job while replacing its attachment hash and version reference', async () => {
    const source = await sourceDocument()
    database.values.set(source.id, { ...source, jobContext })
    const revision = await createResumeRevision(source.id, revisedText, originalText)
    const expectedHash = Buffer.from(await crypto.subtle.digest('SHA-256', await revision.originalFile!.arrayBuffer())).toString('hex')
    expect(revision.jobContext).toEqual({ ...jobContext, resumeVersion: expectedHash, resumeDocumentId: revision.id, resumeUpdatedAt: revision.originalFileUpdatedAt })
    expect(revision.jobContext?.resumeVersion).not.toBe(jobContext.resumeVersion)
    expect((await loadResumeDocument(source.id))?.jobContext).toEqual(jobContext)
    await setCurrentResumeDocument(revision.id)
    expect(await listResumeAttachments()).toEqual(expect.arrayContaining([expect.objectContaining({ id: revision.id, name: revision.originalFile!.name, file: revision.originalFile, current: true })]))
  })

  it('keeps both the original and new file available in the attachment library', async () => {
    const source = await sourceDocument()
    const revision = await createResumeRevision(source.id, revisedText, originalText)
    await setCurrentResumeDocument(revision.id)
    const attachments = await listResumeAttachments()
    expect(attachments).toHaveLength(2)
    expect(attachments.find(item => item.id === source.id)).toMatchObject({ current: false, file: source.originalFile })
    expect(attachments.find(item => item.id === revision.id)).toMatchObject({ current: true, file: revision.originalFile })
  })

  it.each([
    ['', '正文不能为空'],
    [' \n\t\u0000', '正文不能为空'],
    ['字'.repeat(20001), '20000 字'],
    [originalText, '还没有修改'],
    [`\n${originalText.replaceAll('\n', '\r\n')}\n`, '还没有修改'],
  ])('rejects invalid or unchanged text without creating another document (%#)', async (text, error) => {
    const source = await sourceDocument()
    const keys = [...database.values.keys()]
    await expect(createResumeRevision(source.id, text, originalText)).rejects.toThrow(error)
    expect([...database.values.keys()]).toEqual(keys)
    expect(await loadResumeDocument(source.id)).toEqual(source)
  })

  it('rejects a removed source or an obsolete editing base', async () => {
    const source = await sourceDocument()
    await expect(createResumeRevision(source.id, revisedText, '更早的原文')).rejects.toThrow('原文已在其他页面更新')
    await deleteResumeDocument(source.id)
    await expect(createResumeRevision(source.id, revisedText, originalText)).rejects.toThrow('原简历已被删除')
    expect([...database.values.keys()].filter(key => key.startsWith('resume-document:'))).toEqual([])
  })

  it.each(['changed', 'deleted'] as const)('rechecks the source if it is %s while the attachment is being generated', async (operation) => {
    const source = await sourceDocument()
    const get = database.get.getMockImplementation()!
    database.get.mockImplementationOnce(get).mockImplementationOnce(async key => {
      if (operation === 'deleted') database.values.delete(source.id)
      else await updateResumeDocument(source.id, { review: { ...review, rawText: '另一页面保存的新原文' } })
      return get(key)
    })
    await expect(createResumeRevision(source.id, revisedText, originalText)).rejects.toThrow('原简历已更新')
    expect([...database.values.keys()].filter(key => key.startsWith('resume-document:revision:'))).toEqual([])
  })

  it('does not clear a newer draft saved after the revision attachment has been persisted', async () => {
    const source = await sourceDocument()
    await saveResumeRevisionDraft(source.id, { baseText: originalText, text: revisedText })
    const newerDraft = { baseText: originalText, text: `${revisedText}\n技能\nTypeScript、Vue` }
    const set = database.set.getMockImplementation()!
    database.set.mockImplementationOnce(async (key, value) => {
      await set(key, value)
      await saveResumeRevisionDraft(source.id, newerDraft)
    })
    const revision = await createResumeRevision(source.id, revisedText, originalText)
    expect(await loadResumeDocument(revision.id)).toEqual(revision)
    expect((await loadResumeDocument(source.id))?.revisionDraft).toEqual(newerDraft)
  })

  it('keeps the edit draft after attachment persistence fails', async () => {
    const source = await sourceDocument()
    const draft = { baseText: originalText, text: revisedText }
    await saveResumeRevisionDraft(source.id, draft)
    database.set.mockRejectedValueOnce(new Error('QuotaExceededError'))
    await expect(createResumeRevision(source.id, revisedText, originalText)).rejects.toThrow('QuotaExceededError')
    expect((await loadResumeDocument(source.id))?.revisionDraft).toEqual(draft)
    expect([...database.values.keys()].filter(key => key.startsWith('resume-document:revision:'))).toEqual([])
  })
})

describe('resumeDocumentForRecord', () => {
  it('reuses an exactly linked document and preserves its original attachment and draft', async () => {
    const source = await sourceDocument()
    const draft = { baseText: originalText, text: revisedText }
    await saveResumeRevisionDraft(source.id, draft)
    const restored = await resumeDocumentForRecord(savedRecord())
    expect(restored.id).toBe(source.id)
    expect(restored.originalFile).toBe(source.originalFile)
    expect(restored.revisionDraft).toEqual(draft)
  })

  it('recovers legacy record text and job metadata without inventing an attachment or touching another version', async () => {
    const source = await sourceDocument()
    await updateResumeDocument(source.id, { review: { ...review, rawText: revisedText } })
    const record = savedRecord({ jobContext, revisionId: 'legacy-revision' })
    const restored = await resumeDocumentForRecord(record)
    expect(restored.id).not.toBe(source.id)
    expect(restored).toMatchObject({ recordId: record.id, jobContext, revisionId: 'legacy-revision', extracted: { text: originalText }, review: { rawText: originalText, jobDescription: review.jobDescription, diagnosis: review.diagnosis } })
    expect(restored.originalFile).toBeUndefined()
    expect(restored.originalFileUpdatedAt).toBeUndefined()
    expect(await listResumeAttachments()).toMatchObject([{ id: source.id }])
    expect((await loadResumeDocument(source.id))?.review?.rawText).toBe(revisedText)
    const draft = { baseText: originalText, text: `${originalText}\n新的修改` }
    await saveResumeRevisionDraft(restored.id, draft)
    expect((await resumeDocumentForRecord(record)).revisionDraft).toEqual(draft)
    expect(database.values.get(record.id)).toEqual(savedRecord())
  })

  it('keeps a legacy record for a different job description separate from an attached current document', async () => {
    const source = await sourceDocument()
    const restored = await resumeDocumentForRecord(savedRecord({ jobDescription: '负责 Vue 开发。' }))
    expect(restored.id).not.toBe(source.id)
    expect(restored.review?.jobDescription).toBe('负责 Vue 开发。')
    expect(restored.originalFile).toBeUndefined()
    expect((await loadResumeDocument(source.id))?.review?.jobDescription).toBe(review.jobDescription)
  })
})
