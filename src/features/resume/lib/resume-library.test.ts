import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ResumeReviewSubmission } from '@/domain/resume-review'
import type { ExtractedText } from './pdf'
import { updateRecordDiagnosis } from '../../../lib/storage'

// IndexedDB serializes read/write transactions. Preserve that ordering in the
// mock so racing autosaves exercise the atomic update contract.
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
      const value = updater(values.get(key))
      values.set(key, value)
    })),
  }
})

vi.mock('idb-keyval', () => database)

import {
  deleteResumeDocument,
  importResumeDocument,
  listResumeAttachments,
  listResumeDocuments,
  loadResumeDocument,
  setCurrentResumeDocument,
  updateResumeDocument,
} from './resume-library'

const extracted = (text = '张三\n项目经历\n负责订单系统开发'): ExtractedText => ({ text, charCount: text.length, pageCount: 1 })
const review = (rawText = extracted().text): ResumeReviewSubmission => ({
  rawText,
  analysisGoal: 'overall',
  reviewedCandidates: [{ content: '负责订单系统开发', sourceSection: '项目经历', lineNumber: 3 }],
  jobDescription: '',
  diagnosis: { source: 'model', summary: '补充项目成果', strengths: [], issues: [], nextSteps: ['写清楚项目中的职责'] },
})

beforeEach(() => {
  database.values.clear()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('resume library', () => {
  it('shows one reusable attachment per version and retains an older job copy after the library file changes', async () => {
    const file = new File(['original'], '简历.txt')
    const original = await importResumeDocument(extracted(), file.name, false, file)
    const frozen = {
      ...original, id: 'resume-document:job:a',
      jobContext: { applicationId: 'a', company: '甲', role: '前端', sourceUrl: 'https://example.com/job', resumeVersion: 'old-file-hash', resumeDocumentId: original.id, resumeUpdatedAt: original.originalFileUpdatedAt! },
    }
    database.values.set(frozen.id, frozen)
    database.values.set('resume-document:job:b', { ...frozen, id: 'resume-document:job:b' })
    await setCurrentResumeDocument(frozen.id)
    expect(await listResumeAttachments()).toMatchObject([{ id: original.id, current: true }])

    database.values.set(original.id, { ...original, originalFile: new File(['replacement'], file.name), originalFileUpdatedAt: original.originalFileUpdatedAt! + 1000 })
    const versions = await listResumeAttachments()
    expect(versions).toHaveLength(2)
    expect(await Promise.all(versions.map(item => item.file.text()))).toEqual(expect.arrayContaining(['original', 'replacement']))
  })

  it('saves an imported document before diagnosis or interview analysis exists', async () => {
    const imported = await importResumeDocument(extracted(), '粘贴文本', false)

    expect(await loadResumeDocument(imported.id)).toEqual(imported)
    expect(await listResumeDocuments()).toEqual([imported])
    expect(imported.review).toBeUndefined()
    expect(imported.recordId).toBeUndefined()
    expect([...database.values.keys()].some(key => key.startsWith('resume-grill:'))).toBe(false)
  })

  it('reuses the actual uploaded file and never manufactures an attachment for pasted or demo text', async () => {
    const bytes = new Uint8Array([37, 80, 68, 70, 0, 255])
    const file = new File([bytes], '张三-产品经理.pdf', { type: 'application/pdf', lastModified: 1234 })
    const document = await importResumeDocument(extracted(), file.name, false, file)
    await importResumeDocument(extracted('只有文本的另一份简历'), '粘贴文本', false)
    await importResumeDocument(extracted(), '示例简历.txt', true)

    const attachments = await listResumeAttachments()
    expect(attachments).toHaveLength(1)
    expect(attachments[0]).toMatchObject({ id: document.id, name: file.name, current: false })
    expect(attachments[0].file).toBeInstanceOf(File)
    expect(attachments[0].file.lastModified).toBe(1234)
    expect(new Uint8Array(await attachments[0].file.arrayBuffer())).toEqual(bytes)
  })

  it('retains diagnosis, practice linkage, and the original attachment when the same text is imported again', async () => {
    const file = new File(['original PDF bytes'], '简历.pdf', { type: 'application/pdf' })
    const original = await importResumeDocument(extracted(), file.name, false, file)
    await updateResumeDocument(original.id, { review: review(), recordId: 'resume-grill:resume:existing' })

    const imported = await importResumeDocument(extracted(), '粘贴文本', false)

    expect(imported.id).toBe(original.id)
    expect(imported.review).toEqual(review())
    expect(imported.recordId).toBe('resume-grill:resume:existing')
    expect(imported.originalFile).toBe(file)
    expect(imported.originalFileUpdatedAt).toBe(original.originalFileUpdatedAt)
    expect(await listResumeDocuments()).toHaveLength(1)
  })

  it('replaces the original file when a newly uploaded version has the same extracted text', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    const original = await importResumeDocument(extracted(), '旧简历.pdf', false, new File(['old'], '旧简历.pdf'))
    await updateResumeDocument(original.id, { review: review() })
    vi.mocked(Date.now).mockReturnValue(2000)
    const replacement = new File(['new layout'], '新简历.pdf')

    const imported = await importResumeDocument(extracted(), replacement.name, false, replacement)

    expect(imported.id).toBe(original.id)
    expect(imported.review).toEqual(review())
    expect(imported.originalFileUpdatedAt).toBe(2000)
    const [attachment] = await listResumeAttachments()
    expect(attachment).toMatchObject({ name: replacement.name, updatedAt: 2000, current: true })
    expect(await attachment.file.text()).toBe('new layout')
  })

  it('invalidates a saved review when extraction whitespace changes its original line references', async () => {
    const original = await importResumeDocument(extracted(), '简历.txt', false)
    await updateResumeDocument(original.id, { review: review() })
    const imported = await importResumeDocument(extracted('张三\n\n项目经历\n负责订单系统开发'), '简历.txt', false)

    expect(imported.id).toBe(original.id)
    expect(imported.review).toBeUndefined()
  })

  it.each(['review-first', 'record-first'] as const)('keeps both review autosaves and record linkage during concurrent updates (%s)', async (order) => {
    const original = await importResumeDocument(extracted(), '简历.txt', false)
    const changes = [{ review: review() }, { recordId: 'resume-grill:resume:linked' }]
    if (order === 'record-first') changes.reverse()

    await Promise.all(changes.map(change => updateResumeDocument(original.id, change)))

    expect(await loadResumeDocument(original.id)).toMatchObject({ review: review(), recordId: 'resume-grill:resume:linked' })
  })

  it('marks only the current document attachment and allows clearing that selection', async () => {
    const first = await importResumeDocument(extracted('第一份简历'), '甲.pdf', false, new File(['A'], '甲.pdf'))
    const second = await importResumeDocument(extracted('第二份简历'), '乙.pdf', false, new File(['B'], '乙.pdf'))
    expect((await listResumeAttachments()).filter(item => item.current).map(item => item.id)).toEqual([second.id])

    await setCurrentResumeDocument(first.id)
    expect((await listResumeAttachments()).filter(item => item.current).map(item => item.id)).toEqual([first.id])

    await setCurrentResumeDocument(null)
    expect((await listResumeAttachments()).some(item => item.current)).toBe(false)
  })

  it('does not revive a deleted resume when a previously scheduled autosave reaches storage', async () => {
    const document = await importResumeDocument(extracted(), '简历.pdf', false, new File(['PDF'], '简历.pdf'))
    const deletion = deleteResumeDocument(document.id)
    const delayedSave = updateResumeDocument(document.id, { review: review() })

    await expect(delayedSave).rejects.toThrow('已被删除')
    await deletion
    expect(await loadResumeDocument(document.id)).toBeUndefined()
    expect(await listResumeDocuments()).toEqual([])
    expect(await listResumeAttachments()).toEqual([])
    expect(database.values.get('current-resume-document')).toBeFalsy()
  })

  it('deleting a different document preserves the current attachment selection', async () => {
    const removed = await importResumeDocument(extracted('旧简历'), '旧.pdf', false, new File(['old'], '旧.pdf'))
    const current = await importResumeDocument(extracted('当前简历'), '新.pdf', false, new File(['new'], '新.pdf'))
    await deleteResumeDocument(removed.id)

    expect(await listResumeAttachments()).toMatchObject([{ id: current.id, current: true }])
  })

  it('propagates an import storage failure without changing the current document', async () => {
    const current = await importResumeDocument(extracted('已存简历'), '甲.pdf', false, new File(['A'], '甲.pdf'))
    database.update.mockRejectedValueOnce(new Error('QuotaExceededError'))

    await expect(importResumeDocument(extracted('新简历'), '乙.pdf', false, new File(['B'], '乙.pdf'))).rejects.toThrow('QuotaExceededError')
    expect(await listResumeDocuments()).toEqual([current])
    expect((await listResumeAttachments()).find(item => item.current)?.id).toBe(current.id)
  })
})


describe('saved diagnosis and existing practice', () => {
  it('updates the report without replacing interview progress', async () => {
    vi.stubGlobal('window', {})
    try {
      const saved = { id: 'resume-grill:resume:existing', analysis: { rawText: extracted().text, jobDescription: '' }, sessions: { claim: [{ version: 2, status: 'in_progress' }] }, preparedClaimIds: ['claim'] }
      database.values.set(saved.id, saved)
      await updateRecordDiagnosis(saved.id, review())
      expect(database.values.get(saved.id)).toEqual({ ...saved, analysis: { ...saved.analysis, diagnosis: review().diagnosis } })
    } finally { vi.unstubAllGlobals() }
  })

  it('does not attach a report for edited text or a different target role to old practice', async () => {
    vi.stubGlobal('window', {})
    try {
      const saved = { id: 'resume-grill:resume:existing', analysis: { rawText: extracted().text, jobDescription: '' }, sessions: {} }
      database.values.set(saved.id, saved)
      await updateRecordDiagnosis(saved.id, review('已修改的简历原文'))
      await updateRecordDiagnosis(saved.id, { ...review(), jobDescription: '新的岗位要求' })
      expect(database.values.get(saved.id)).toEqual(saved)
    } finally { vi.unstubAllGlobals() }
  })
})
