// @vitest-environment jsdom
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MailWorkbench } from './MailWorkbench'
import { initialMailDefaults } from './mail-defaults'
import type { Draft, SavedJobPreparation } from './draft-state'
import type { ComponentProps } from 'react'
import type { JobResumeDialog } from './JobResumeDialog'

const mocks = vi.hoisted(() => ({ persist: vi.fn(), command: vi.fn(), tailoringError: '' }))
vi.mock('./hooks/use-mail-agent', () => ({ useMailAgent: () => ({
  snapshot: { sender: { name: '张三', address: 'candidate@qq.com' }, jobs: [] },
  connectionError: '', request: vi.fn(), command: mocks.command,
}) }))
vi.mock('./LocalSetupStatus', () => ({ LocalSetupStatus: () => null }))
vi.mock('./JobResumeDialog', () => ({ JobResumeDialog: (props: ComponentProps<typeof JobResumeDialog>) => createElement('button', {
  'data-testid': 'apply-tailoring', onClick: () => void props.onApply({ company: '示例公司', role: '前端', subject: '岗位求职信', body: '参与页面开发，附件为岗位版。', automatic: false }, {
    jobDescription: props.draft.jobDescription!, attachment: new File(['pdf'], '岗位版.pdf'),
    tailoredResume: { jobDescription: props.draft.jobDescription!, company: '示例公司', role: '前端', sourceFile: props.file, documentId: 'revision', text: '参与页面开发' },
  }).catch(error => { mocks.tailoringError = String(error) }),
}, '确认岗位版') }))
vi.mock('./mail-attachment', () => ({ encodeAttachment: async () => 'cmVzdW1l' }))
vi.mock('./hooks/use-mail-drafts', () => ({ useMailDrafts: () => {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preparationByJob, setPreparationByJob] = useState<Record<string, SavedJobPreparation>>({})
  return {
    drafts, setDrafts, selectedDraftIds, setSelectedDraftIds, selectedId, setSelectedId,
    attachment: new File(['resume'], 'resume.txt'), libraryAttachments: [], libraryError: false,
    hydrated: true, websiteApplications: [], preparationByJob, defaults: initialMailDefaults(),
    setTab: vi.fn(), setDefaults: vi.fn(), setAttachment: vi.fn(), setAttachmentSource: vi.fn(),
    setWebsiteApplications: vi.fn(), setPreparationByJob, persist: mocks.persist,
  }
} }))

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  vi.clearAllMocks()
  mocks.tailoringError = ''
  mocks.persist.mockResolvedValue(undefined); mocks.command.mockResolvedValue(undefined)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  HTMLDialogElement.prototype.showModal = vi.fn()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
async function input(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function openPreview() {
  await act(async () => root.render(createElement(MailWorkbench, {
    badges: { claimTotal: 0, highUntested: 0, testingActive: 0, testedDone: 0, knowledgeOpen: 0 },
    onNavigate: vi.fn(), onHome: vi.fn(), onPrepare: vi.fn(),
  })))
  const email = host.querySelector<HTMLInputElement>('#quick-mail-recipient')!
  expect(email.closest('[hidden]')).toBeNull()
  await input(email, 'hr@example.com')
  await act(async () => { email.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
}

it('只填邮箱直达预览；修改后重新确认，发送内容包含修改并保存草稿', async () => {
  await openPreview()
  expect(host.querySelector('[role="alert"]')?.textContent).toBeUndefined()
  const dialog = host.querySelector('dialog')!
  expect(dialog.textContent).toContain('hr@example.com')
  expect(mocks.command).not.toHaveBeenCalled()
  const send = [...dialog.querySelectorAll('button')].find(button => button.textContent?.includes('确认并发送'))!
  expect(send.disabled).toBe(true)
  const checkbox = dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')!
  await act(async () => checkbox.click())
  expect(send.disabled).toBe(false)
  const body = dialog.querySelector('textarea')!
  await input(body, '我的求职邮件正文')
  expect(send.disabled).toBe(true)
  await input(body, '')
  await act(async () => checkbox.click())
  expect(send.disabled).toBe(true)
  await input(body, '我的求职邮件正文')
  await act(async () => checkbox.click())
  await act(async () => send.click())
  expect(mocks.command).toHaveBeenCalledOnce()
  expect(mocks.command.mock.calls[0][1].jobs[0]).toMatchObject({ company: '', role: '', recipient: 'hr@example.com', body: '我的求职邮件正文' })
  expect(mocks.persist.mock.calls.at(-1)![0].drafts[0]).toMatchObject({ body: '我的求职邮件正文', automatic: false })
})

it('存储失败显示错误，不继续预览或发送', async () => {
  mocks.persist.mockRejectedValue(new Error('无法保存草稿'))
  await openPreview()
  expect(host.querySelector('dialog')).toBeNull()
  expect(host.textContent).toContain('无法保存草稿')
  expect(mocks.command).not.toHaveBeenCalled()
})
it('邮箱加 JD 经核对后直接预览，发送使用岗位版 PDF，仍需最后确认', async () => {
  await act(async () => root.render(createElement(MailWorkbench, { badges: { claimTotal: 0, highUntested: 0, testingActive: 0, testedDone: 0, knowledgeOpen: 0 }, onNavigate: vi.fn(), onHome: vi.fn(), onPrepare: vi.fn() })))
  const email = host.querySelector<HTMLInputElement>('#quick-mail-recipient')!
  await input(email, 'hr@example.com')
  await input(email.form!.querySelector('textarea')!, '前端岗位，负责页面开发')
  await act(async () => { email.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  expect(host.querySelector('dialog')).toBeNull()
  await act(async () => (host.querySelector('[data-testid=apply-tailoring]') as HTMLButtonElement).click())
  const preview = host.querySelector('dialog')!
  expect(preview.textContent).toContain('岗位版.pdf')
  expect(mocks.persist).toHaveBeenCalledTimes(2)
  expect((preview.querySelector('textarea') as HTMLTextAreaElement).value).toContain('附件为岗位版')
  const send = [...preview.querySelectorAll('button')].find(button => button.textContent?.includes('确认并发送'))!
  expect(send.disabled).toBe(true); expect(mocks.command).not.toHaveBeenCalled()
  await act(async () => preview.querySelector<HTMLInputElement>('input[type=checkbox]')!.click())
  await act(async () => send.click())
  expect(mocks.command.mock.calls[0][1].attachment.name).toBe('岗位版.pdf')
  expect(mocks.persist.mock.calls.at(-1)![0].preparationByJob).toMatchObject({ [mocks.command.mock.calls[0][1].jobs[0].id]: { attachmentUse: 'mail', tailoredResume: { role: '前端' } } })
})
it('岗位版保存失败后不改写当前岗位，可原地重试并进入预览', async () => {
  await act(async () => root.render(createElement(MailWorkbench, { badges: { claimTotal: 0, highUntested: 0, testingActive: 0, testedDone: 0, knowledgeOpen: 0 }, onNavigate: vi.fn(), onHome: vi.fn(), onPrepare: vi.fn() })))
  const email = host.querySelector<HTMLInputElement>('#quick-mail-recipient')!
  await input(email, 'hr@example.com')
  await input(email.form!.querySelector('textarea')!, '前端岗位，负责页面开发')
  await act(async () => { email.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  mocks.persist.mockRejectedValueOnce(new Error('存储不可用'))
  await act(async () => (host.querySelector('[data-testid=apply-tailoring]') as HTMLButtonElement).click())
  expect(mocks.tailoringError).toContain('存储不可用')
  expect(host.querySelector('dialog')).toBeNull()
  expect((host.querySelector('input[aria-label^="公司 "]') as HTMLInputElement).value).toBe('')
  await act(async () => (host.querySelector('[data-testid=apply-tailoring]') as HTMLButtonElement).click())
  expect(host.querySelector('dialog')!.textContent).toContain('岗位版.pdf')
  expect(mocks.command).not.toHaveBeenCalled()
})
