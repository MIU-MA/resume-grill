// @vitest-environment jsdom
import { act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MailWorkbench } from './MailWorkbench'
import { initialMailDefaults } from './mail-defaults'
import type { Draft } from './draft-state'

const sender = { name: '演示用户', address: 'demo@qq.com' }
const draft: Draft = { id: 'a034dbde-b56b-4b00-98cc-319633e12ab3', company: '', role: '', recipient: 'hr@example.com', subject: '应聘', body: '附件是我的简历', sourceConfirmed: true, sourceUrl: '' }
const persist = vi.fn(async () => {})
vi.mock('./hooks/use-mail-agent', () => ({ useMailAgent: () => ({ snapshot: { sender, jobs: [], running: false }, connectionError: '', token: '', command: vi.fn() }) }))
vi.mock('./LocalSetupStatus', () => ({ LocalSetupStatus: () => null }))
vi.mock('./hooks/use-application-tracker', () => ({ useApplicationTracker: () => ({ loaded: true, tracker: { mailJobs: [], submissions: {}, progress: {} }, capture: vi.fn() }) }))
vi.mock('./hooks/use-mail-drafts', () => ({ useMailDrafts: () => {
  const [attachment, setAttachment] = useState<File | null>(null)
  const [drafts, setDrafts] = useState([draft])
  return { drafts, setDrafts, attachment, setAttachment, attachmentSource: undefined, setAttachmentSource: vi.fn(), defaults: initialMailDefaults(), setDefaults: vi.fn(), selectedDraftIds: [draft.id], setSelectedDraftIds: vi.fn(), libraryAttachments: [], libraryError: false, hydrated: true, websiteApplications: [], setWebsiteApplications: vi.fn(), preparationByJob: {}, setPreparationByJob: vi.fn(), selectedId: draft.id, setSelectedId: vi.fn(), setTab: vi.fn(), persist }
} }))
let root: Root, host: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); sessionStorage.clear()
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
it('缺附件只请求选择，选完自动进入预览，不残留校验错误；草稿删除可撤销', async () => {
  await act(async () => root.render(createElement(MailWorkbench, { mode: 'applications', badges: { claimTotal: 0, highUntested: 0, testingActive: 0, testedDone: 0, knowledgeOpen: 0 }, onNavigate: vi.fn(), onHome: vi.fn(), onPrepare: vi.fn() })))
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent?.startsWith('预览并发送'))!.click())
  expect(host.querySelector('dialog')).toBeNull()
  expect(host.querySelector('[role=alert]')).toBeNull()
  const fileInput = host.querySelector<HTMLInputElement>('input[type=file]')!
  Object.defineProperty(fileInput, 'files', { value: [new File(['resume'], '简历.pdf', { type: 'application/pdf' })], configurable: true })
  await act(async () => { fileInput.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(resolve => setTimeout(resolve, 40)) })
  expect(host.querySelector('dialog')!.textContent).toContain('统一核对')
  expect(host.querySelector('dialog')!.textContent).toContain('简历.pdf')
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === '返回清单')!.click())
  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="移除 岗位"]')!.click())
  expect(host.textContent).toContain('已移除草稿')
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === '撤销')!.click())
  expect(host.querySelector('[aria-label="移除 岗位"]')).not.toBeNull()
})
