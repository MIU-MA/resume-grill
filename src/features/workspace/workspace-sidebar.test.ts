// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { WorkspaceSidebar } from './WorkspaceSidebar'

let root: Root
let host: HTMLDivElement
const props = {
  mode: 'report' as const, collapsed: false, variant: 'dock' as const,
  onNavigate: vi.fn(), onOpenHistory: vi.fn(), onOpenSettings: vi.fn(), onToggleCollapsed: vi.fn(),
  badges: { claimTotal: 5, highUntested: 2, testingActive: 1, testedDone: 2, knowledgeOpen: 3 },
}
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.clearAllMocks()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })

it('分组入口分别到达对应页面，当前页只高亮一项', async () => {
  await act(async () => root.render(createElement(WorkspaceSidebar, props)))
  expect([...host.querySelectorAll('nav section')].map(node => node.getAttribute('aria-label'))).toEqual(['简历', '投递', '面试'])
  expect([...host.querySelectorAll('[aria-current="page"]')].map(node => node.getAttribute('aria-label'))).toEqual(['面试复盘'])
  const destinations = { 招聘官网: 'careers', 投递清单: 'applications', 投递记录: 'application-history', 简历检查: 'diagnosis', 面试准备: 'audit', 模拟面试: 'interview', 面试复盘: 'report', 待复习: 'knowledge' }
  for (const [label, mode] of Object.entries(destinations)) {
    await act(async () => host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!.click())
    expect(props.onNavigate).toHaveBeenLastCalledWith(mode)
  }
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="简历库"]')!.click())
  expect(props.onOpenHistory).toHaveBeenCalledOnce()
})

it('收起后键盘聚焦的提示仍通过 portal 显示，离开后消失', async () => {
  await act(async () => root.render(createElement(WorkspaceSidebar, { ...props, collapsed: true })))
  const button = host.querySelector<HTMLButtonElement>('button[aria-label="招聘官网"]')!
  await act(async () => button.focus())
  const tooltip = document.querySelector('[role="tooltip"]')!
  expect(tooltip.textContent).toBe('招聘官网')
  expect(host.contains(tooltip)).toBe(false)
  expect(button.getAttribute('aria-describedby')).toBe(tooltip.id)
  await act(async () => button.blur())
  expect(document.querySelector('[role="tooltip"]')).toBeNull()
})

it('小屏选择目的地后收起抽屉', async () => {
  const onClose = vi.fn()
  await act(async () => root.render(createElement(WorkspaceSidebar, { ...props, variant: 'drawer', open: true, onClose })))
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="投递记录"]')!.click())
  expect(props.onNavigate).toHaveBeenLastCalledWith('application-history')
  expect(onClose).toHaveBeenCalledOnce()
})
