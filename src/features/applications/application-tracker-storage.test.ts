import { beforeEach, expect, it, vi } from 'vitest'
import type { MailBatch } from '@/domain/mail-schema'
import { changeApplicationProgress } from '@/domain/application-progress'
const db = vi.hoisted(() => {
  const values = new Map<string, unknown>()
  let pending = Promise.resolve()
  return { values, get: vi.fn(async (key: string) => values.get(key)), update: vi.fn((key: string, change: (current: unknown) => unknown) => {
    const write = pending.catch(() => undefined).then(() => { values.set(key, change(values.get(key))) })
    pending = write
    return write
  }) }
})
vi.mock('idb-keyval', () => db)
import { captureMailSubmissions, loadApplicationTracker, updateApplicationTracker } from './application-tracker-storage'
beforeEach(() => { db.values.clear(); vi.clearAllMocks() })
it('旧安装没有进展数据时正常加载；并行保存岗位进展和附件不会互相覆盖', async () => {
  expect(await loadApplicationTracker()).toEqual({ progress: {}, mailJobs: [], submissions: {}, manualApplications: [], hiddenMailJobIds: [] })
  await Promise.all([
    updateApplicationTracker(current => ({ ...current, progress: { ...current.progress, a: changeApplicationProgress(current.progress.a, { stage: 'replied' }, 1) } })),
    updateApplicationTracker(current => ({ ...current, submissions: { ...current.submissions, b: { jobDescription: '前端', at: 1, channel: 'website' } } })),
    updateApplicationTracker(current => ({ ...current, progress: { ...current.progress, b: changeApplicationProgress(current.progress.b, { stage: 'offer' }, 2) } })),
  ])
  const saved = await loadApplicationTracker()
  expect(saved.progress.a.stage).toBe('replied')
  expect(saved.progress.b.stage).toBe('offer')
  expect(saved.submissions.b.jobDescription).toBe('前端')
})
it('存储失败向调用方报错，重试仍可成功', async () => {
  db.update.mockRejectedValueOnce(new Error('quota'))
  await expect(updateApplicationTracker(current => current)).rejects.toThrow('quota')
  await expect(updateApplicationTracker(current => current)).resolves.toEqual({ progress: {}, mailJobs: [], submissions: {}, manualApplications: [], hiddenMailJobIds: [] })
})
it('附件快照来自最终邮件批次，保留各岗位的实际字节，而非当前全局附件', async () => {
  const batch = { attachment: { name: '原版.pdf', base64: btoa('original bytes') }, jobs: [{ id: 'a' }, { id: 'b', attachment: { name: '岗位版.pdf', base64: btoa('tailored bytes') } }] } as MailBatch
  const descriptions = { a: '原始 JD', b: '另一岗位 JD' }
  const captured = captureMailSubmissions(batch, descriptions, 12)
  batch.attachment.name = 'later.pdf'; descriptions.a = '后来修改的 JD'
  expect(captured.a.attachment.name).toBe('原版.pdf')
  expect(captured.a.jobDescription).toBe('原始 JD')
  expect(await captured.a.attachment.text()).toBe('original bytes')
  expect(await captured.b.attachment.text()).toBe('tailored bytes')
})
