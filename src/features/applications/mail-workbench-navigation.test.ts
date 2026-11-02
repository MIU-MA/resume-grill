// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MailWorkbench } from './MailWorkbench'
import { initialMailDefaults } from './mail/lib/mail-defaults'

vi.mock('./jobs/CareerJobsView', () => ({ CareerJobsView: () => '岗位列表' }))
vi.mock('./hooks/use-mail-agent', () => ({ useMailAgent: () => ({ snapshot: null, connectionError: '', request: vi.fn(), command: vi.fn() }) }))
vi.mock('./history/hooks/use-application-tracker', () => ({ useApplicationTracker: () => ({
  loaded: true,
  tracker: { mailJobs: [], submissions: {}, progress: {}, manualApplications: [], hiddenMailJobIds: [] },
  saveProgress: vi.fn(), capture: vi.fn(), restoreSubmission: vi.fn(), saveManual: vi.fn(), removeManual: vi.fn(), restoreManual: vi.fn(), hideJob: vi.fn(), unhideJob: vi.fn(),
}) }))
vi.mock('./mail/hooks/use-mail-drafts', () => ({ useMailDrafts: () => ({
  drafts: [], selectedDraftIds: [], attachment: null, libraryAttachments: [], libraryError: false,
  hydrated: true, websiteApplications: [], preparationByJob: {}, selectedId: null,
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

it('官网、清单、记录按路由展示，投递页的链接入口不会在路由间重建', async () => {
  await act(async () => root.render(createElement(MailWorkbench, { ...props, mode: 'careers' })))
  expect(host.querySelector('header h1')!.textContent).toBe('AI 找岗位')
  expect(host.textContent).toContain('AI 找岗位暂不可用')
  expect(host.querySelector('.mail-empty')).toBeNull()
  expect(host.querySelector('#career-import-links')).toBeNull()

  await act(async () => root.render(createElement(MailWorkbench, { ...props, mode: 'application-history' })))
  expect(host.querySelector('header h1')!.textContent).toBe('投递记录')
  expect(host.querySelector('[aria-label="投递记录"]')).not.toBeNull()

  await act(async () => root.render(createElement(MailWorkbench, { ...props, mode: 'applications' })))
  expect(host.querySelector('header h1')!.textContent).toBe('投递清单')
  expect(host.querySelector('#career-import-links')).toBeNull()
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent?.includes('添加岗位'))!.click())
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent?.includes('官网链接'))!.click())
  expect(host.querySelector('#career-import-links')).not.toBeNull()
  await act(async () => root.render(createElement(MailWorkbench, { ...props, mode: 'application-history' })))
  expect(host.querySelector('#career-import-links')).toBeNull()
  await act(async () => root.render(createElement(MailWorkbench, { ...props, mode: 'applications' })))
  expect(host.querySelector('#career-import-links')).not.toBeNull()
  expect(host.querySelector('.mail-empty')).not.toBeNull()
})
