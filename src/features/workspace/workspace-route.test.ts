// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { WorkspaceRoute } from './WorkspaceRoute'
import { WorkspaceRouteContext, type WorkspaceRouteState } from './workspace-route-context'
vi.mock('next/dynamic', () => ({ default: () => () => createElement('p', null, '按需加载的页面') }))
vi.mock('@/features/resume/ReviewWorkspace', () => ({ ReviewWorkspace: ({ children }: { children: import('react').ReactNode }) => children }))
it('各路由从共享状态渲染自己的页面，切换页面不需要清空状态', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div'), root = createRoot(host)
  const state = { workspace: { knowledgeReady: true, knowledgeItems: [], analysis: null }, interview: { activeClaimSnapshot: null }, knowledgeActions: {}, actions: {}, mode: 'knowledge', phase: 'workspace', sidebarBadges: {} } as unknown as WorkspaceRouteState
  try {
    await act(async () => root.render(createElement(WorkspaceRouteContext.Provider, { value: state }, createElement(WorkspaceRoute, { mode: 'knowledge' }))))
    expect(host.textContent).toContain('按需加载的页面')
    await act(async () => root.render(createElement(WorkspaceRouteContext.Provider, { value: state }, createElement(WorkspaceRoute, { mode: 'diagnosis' }))))
    expect(host.textContent).toContain('按需加载的页面')
    expect(state.workspace.knowledgeItems).toEqual([])
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals() }
})
