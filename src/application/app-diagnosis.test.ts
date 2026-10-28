// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
const state = vi.hoisted(() => ({ mode: 'diagnosis', push: vi.fn(), replace: vi.fn(), analysis: { jobDescription: '投递岗位的 JD', jobContext: { applicationId: 'job' }, claims: [] } as unknown, check: vi.fn(), confirm: vi.fn() }))
vi.mock('./hooks/use-app-navigation', () => ({ useAppNavigation: () => ({ phase: 'workspace', mode: state.mode, push: state.push, replace: state.replace }) }))
vi.mock('./hooks/use-resume-workspace', () => ({ useResumeWorkspace: () => ({ analysis: state.analysis, knowledgeItems: [], sessions: {}, masteredBlindSpotIds: [], preparedClaimIds: [], claimPriorityOverrides: {}, selected: null, stats: null, recovering: state.mode === 'diagnosis', recoveredFromStorage: true, envConfigured: false, clientConfigured: false, refreshClientLlm: vi.fn() }) }))
vi.mock('./hooks/use-resume-analysis', () => ({ useResumeAnalysis: () => ({ handleConfirmText: state.confirm }) }))
vi.mock('./hooks/use-claim-actions', () => ({ useClaimActions: () => ({}) }))
vi.mock('./hooks/use-knowledge-actions', () => ({ useKnowledgeActions: () => ({}) }))
vi.mock('@/features/interview/hooks/use-interview', () => ({ useInterview: () => ({ activeClaimSnapshot: null, rounds: [], loading: false, reset: vi.fn() }) }))
vi.mock('./ResumeCheckWorkspace', () => ({ ResumeCheckWorkspace: (props: unknown) => { state.check(props); return createElement('p', {}, '独立简历检查') } }))
vi.mock('@/features/applications/MailWorkbench', () => ({ MailWorkbench: ({ onNavigate }: { onNavigate: (mode: string) => void }) => createElement('button', { onClick: () => onNavigate('diagnosis') }, '打开简历检查') }))
let host: HTMLDivElement, root: Root
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  state.mode = 'diagnosis'; state.analysis = { jobDescription: '投递岗位的 JD', jobContext: { applicationId: 'job' }, claims: [] }
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('直接打开检查路由时，即使正在恢复岗位面试，也进入独立文档工作区', async () => {
  await act(async () => root.render(createElement(App)))
  expect(host.textContent).toBe('独立简历检查')
  expect(state.check.mock.calls.at(-1)?.[0]).not.toHaveProperty('analysis')
  expect(state.check.mock.calls.at(-1)?.[0]).not.toHaveProperty('jobContext')
})
it('尚未建立面试记录时，从投递侧也能直接进入独立检查入口', async () => {
  state.mode = 'applications'; state.analysis = null
  await act(async () => root.render(createElement(App)))
  await act(async () => host.querySelector('button')!.click())
  expect(state.replace).toHaveBeenCalledWith('workspace', 'diagnosis')
  expect(state.push).not.toHaveBeenCalledWith('upload')
})
