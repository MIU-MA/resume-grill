// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MailPreview } from './MailPreview'
import { JobPreparationPanel } from '../jobs/JobPreparationPanel'
import type { MailBatch } from '@/domain/mail-schema'
let host: HTMLDivElement, root: Root
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
it('多封邮件的收件人、实际附件和正文全部可见，确认仍需用户主动勾选', async () => {
  const batch: MailBatch = { id: crypto.randomUUID(), sender: { name: '演示', address: 'demo@qq.com' }, attachment: { name: '原稿.pdf', base64: 'YQ==' }, jobs: [1, 2].map(index => ({ id: crypto.randomUUID(), company: '演示公司', role: '工程师', sourceUrl: 'https://example.com/jobs', recipient: `hr${index}@example.com`, subject: `主题${index}`, body: `邮件正文${index}`, sourceConfirmed: true, ...(index === 2 ? { attachment: { name: '岗位版.pdf', base64: 'Yg==' } } : {}) })) }
  await act(async () => root.render(createElement(MailPreview, { batch, onEdit: vi.fn(), onClose: vi.fn(), onSend: vi.fn() })))
  expect(host.querySelectorAll('textarea')).toHaveLength(2)
  for (const field of host.querySelectorAll('textarea')) expect(field.closest('details:not([open])')).toBeNull()
  expect(host.textContent).toContain('hr1@example.com'); expect(host.textContent).toContain('hr2@example.com')
  expect(host.textContent).toContain('原稿.pdf'); expect(host.textContent).toContain('岗位版.pdf')
  expect(host.querySelector<HTMLInputElement>('input[type=checkbox]')!.checked).toBe(false)
})
it('岗位要求为空时直接展开并聚焦，已填写的初始状态显示字数', async () => {
  const prepare = vi.fn()
  await act(async () => root.render(createElement(JobPreparationPanel, { jobDescription: '', attachmentLabel: '简历.pdf', busy: false, onChange: vi.fn(), onPrepare: prepare })))
  expect(host.querySelector('details')!.open).toBe(true)
  expect(document.activeElement).toBe(host.querySelector('textarea'))
  await act(async () => root.unmount()); root = createRoot(host)
  await act(async () => root.render(createElement(JobPreparationPanel, { jobDescription: '岗位要求', attachmentLabel: '简历.pdf', busy: false, onChange: vi.fn(), onPrepare: prepare })))
  expect(host.querySelector('details')!.open).toBe(false)
  expect(host.querySelector('summary')!.textContent).toContain('4 字')
})
