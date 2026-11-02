import { describe, expect, it } from 'vitest'
import { draftResumeAttachment } from './mail-attachment'
import type { DraftStore, LibraryAttachment } from './mail-draft-storage'

const original = new File(['original'], '张三.pdf', { type: 'application/pdf' })
const revision = new File(['revised'], '张三-修改稿.pdf', { type: 'application/pdf' })
const library: LibraryAttachment[] = [
  { id: 'old', name: original.name, file: original, updatedAt: 100, current: false },
  { id: 'new', name: revision.name, file: revision, updatedAt: 200, current: true, revisionOf: 'old' },
]
const saved: DraftStore = { drafts: [], attachment: original, attachmentSource: { id: 'old', updatedAt: 100 } }

describe('投递附件与修改稿', () => {
  it('当前附件对应原稿时跟随其直接修改稿，不改变历史附件快照', () => {
    const snapshot = { ...saved, preparationByJob: { job: { jobDescription: 'React', attachment: original, attachmentUse: 'mail' as const } } }
    expect(draftResumeAttachment(snapshot, library)).toEqual({ file: revision, source: { id: 'new', updatedAt: 200 } })
    expect(snapshot.preparationByJob.job.attachment).toBe(original)
    expect(snapshot.attachment).toBe(original)
  })
  it('手动选的本地附件、其他简历和不同原稿版本保持原选择', () => {
    expect(draftResumeAttachment({ ...saved, attachmentSource: undefined }, library)?.file).toBe(original)
    expect(draftResumeAttachment({ ...saved, attachmentSource: { id: 'other', updatedAt: 100 } }, library)?.file).toBe(original)
    expect(draftResumeAttachment({ ...saved, attachmentSource: { id: 'old', updatedAt: 99 } }, library)?.file).toBe(original)
  })
  it('首次投递默认使用当前简历，没有附件时仍可手动选择', () => {
    expect(draftResumeAttachment(undefined, library)?.file).toBe(revision)
    expect(draftResumeAttachment(undefined, [])).toBeNull()
  })
})
