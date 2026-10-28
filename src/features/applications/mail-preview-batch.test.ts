// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { createMailPreviewBatch } from './mail-preview-batch'
import type { Draft, SavedJobPreparation } from './draft-state'
vi.mock('./mail-attachment', () => ({ encodeAttachment: async (file: File) => Buffer.from(file.name).toString('base64') }))
const sender = { address: 'candidate@qq.com', name: '林同学' }
const draft = (role: string): Draft => ({ id: crypto.randomUUID(), company: '示例公司', role, sourceUrl: '', jobDescription: '岗位要求', recipient: 'hr@example.com', subject: '应聘', body: '附件是简历', sourceConfirmed: false })
const saved = (job: Draft, file: File): SavedJobPreparation => ({ jobDescription: '岗位要求', attachment: file, tailoredResume: { jobDescription: '岗位要求', company: job.company, role: job.role, sourceFile: new File(['original'], 'original.txt'), documentId: 'revision-1', text: '岗位版' } })
it('批次为每个岗位选择各自的附件，捕获精确版本供历史使用', async () => {
  const a = draft('前端'); const b = draft('工程师'); const c = draft('开发')
  const original = new File(['original'], 'original.txt')
  const pdfA = new File(['pdf-a'], '前端.pdf'); const pdfB = new File(['pdf-b'], '工程师.pdf')
  const result = await createMailPreviewBatch([a, b, c], { [a.id]: saved(a, pdfA), [b.id]: saved(b, pdfB) }, original, undefined, sender)
  expect(result.batch.attachment.name).toBe('前端.pdf')
  expect(result.batch.jobs[0].attachment).toBeUndefined()
  expect(result.batch.jobs[1].attachment?.name).toBe('工程师.pdf')
  expect(result.batch.jobs[2].attachment?.name).toBe('original.txt')
  expect(result.captured[a.id].attachment).toBe(pdfA)
  expect(result.captured[b.id].tailoredResume?.role).toBe('工程师')
  expect(result.captured[c.id].attachment).toBe(original)
})
it('JD、公司或岗位变化后阻止发送旧岗位版，不悄悄切回原简历', async () => {
  const job = draft('前端'); const pdf = new File(['x'], '前端.pdf')
  for (const change of [{ jobDescription: '另一个JD' }, { company: '另一公司' }, { role: '后端' }]) {
    await expect(createMailPreviewBatch([{ ...job, ...change }], { [job.id]: saved(job, pdf) }, pdf, undefined, sender)).rejects.toThrow('重新生成')
  }
})
