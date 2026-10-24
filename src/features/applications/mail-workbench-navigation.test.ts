// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MailWorkbench } from './MailWorkbench'
import { initialMailDefaults } from './mail-defaults'

vi.mock('./hooks/use-mail-agent', () => ({ useMailAgent: () => ({ snapshot: null, connectionError: '', request: vi.fn(), command: vi.fn() }) }))
vi.mock('./hooks/use-mail-drafts', () => ({ useMailDrafts: () => ({
  drafts: [], selectedDraftIds: [], attachment: null, libraryAttachments: [], libraryError: false,
  hydrated: true, websiteApplications: [], preparationByJob: {}, selectedId: null,
  // 保存的旧页签不应覆盖明确的路由。
  tab: 'history', defaults: initialMailDefaults(),
  setTab: vi.fn(), setDrafts: vi.fn(), setDefaults: vi.fn(), setSelectedDraftIds: vi.fn(), setAttachment: vi.fn(),
  setAttachmentSource: vi.fn(), setWebsiteApplications: vi.fn(), setPreparationByJob: vi.fn(), setSelectedId: vi.fn(), persist: vi.fn(),
}) }))

let root: Root
let host: HTMLDivElement
const props = {
  badges: { claimTotal: 0, highUntested: 0, testingActive: 0, testedDone: 0, knowledgeOpen: 0 },
  onNavigate: vi.fn(), onHome: vi.fn(), onPrepare: vi.fn(),
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })

it('官网、清单、记录按路由展示，切换时保留未整理的链接', async () => {
  await act(async () => root.render(createElement(MailWorkbench, { ...props, mode: 'careers' })))
  expect(host.querySelector('main h1')!.textContent).toBe('招聘官网')
  expect(host.querySelector('.career-directory-disclosure')!.hasAttribute('open')).toBe(true)
  expect(host.querySelector('.mail-empty')).toBeNull()
  const input = host.querySelector<HTMLTextAreaElement>('#career-import-links')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, 'https://example.com/jobs/123')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => root.render(createElement(MailWorkbench, { ...props, mode: 'application-history' })))
  expect(host.querySelector('main h1')!.textContent).toBe('投递记录')
  expect(input.closest('[hidden]')).not.toBeNull()
  expect(host.querySelector('[aria-label="投递记录"]')).not.toBeNull()
  await act(async () => root.render(createElement(MailWorkbench, { ...props, mode: 'applications' })))
  expect(host.querySelector('main h1')!.textContent).toBe('投递清单')
  expect(input.closest('[hidden]')).toBeNull()
  expect(host.querySelector<HTMLTextAreaElement>('#career-import-links')!.value).toBe('https://example.com/jobs/123')
  expect(host.querySelector('.mail-empty')).not.toBeNull()
})
