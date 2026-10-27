// @vitest-environment jsdom
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MailWorkbench } from './MailWorkbench'
import { initialMailDefaults } from './mail-defaults'
import type { Draft } from './draft-state'

const mocks = vi.hoisted(() => ({ persist: vi.fn(), command: vi.fn() }))
vi.mock('./hooks/use-mail-agent', () => ({ useMailAgent: () => ({
  snapshot: { sender: { name: '张三', address: 'candidate@qq.com' }, jobs: [] },
  connectionError: '', request: vi.fn(), command: mocks.command,
}) }))
vi.mock('./LocalSetupStatus', () => ({ LocalSetupStatus: () => null }))
vi.mock('./mail-attachment', () => ({ encodeAttachment: async () => 'cmVzdW1l' }))
vi.mock('./hooks/use-mail-drafts', () => ({ useMailDrafts: () => {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  return {
    drafts, setDrafts, selectedDraftIds, setSelectedDraftIds, selectedId, setSelectedId,
    attachment: new File(['resume'], 'resume.txt'), libraryAttachments: [], libraryError: false,
    hydrated: true, websiteApplications: [], preparationByJob: {}, defaults: initialMailDefaults(),
    setTab: vi.fn(), setDefaults: vi.fn(), setAttachment: vi.fn(), setAttachmentSource: vi.fn(),
    setWebsiteApplications: vi.fn(), setPreparationByJob: vi.fn(), persist: mocks.persist,
  }
} }))

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  vi.clearAllMocks()
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
