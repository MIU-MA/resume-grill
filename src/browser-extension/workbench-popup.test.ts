// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mountWorkbenchPopup } from './workbench-popup'
import { connectWorkbench } from './workbench-connection'

vi.mock('./workbench-connection', () => ({ connectWorkbench: vi.fn() }))
const current = { id: 3, url: 'http://localhost:3000/applications', windowId: 1, lastAccessed: 2 } as chrome.tabs.Tab
const other = { id: 7, url: 'http://127.0.0.1:3107/applications', windowId: 2, lastAccessed: 5 } as chrome.tabs.Tab
const fake = {
  tabs: { query: vi.fn(async (query: chrome.tabs.QueryInfo) => query.currentWindow ? [current] : [other, current]), update: vi.fn(), create: vi.fn() },
  windows: { update: vi.fn() },
  permissions: { contains: vi.fn(async () => false) },
}
let host: HTMLElement
const button = () => host.querySelector<HTMLButtonElement>('button')!
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('chrome', fake)
  fake.permissions.contains.mockResolvedValue(false)
  vi.mocked(connectWorkbench).mockResolvedValue('已连接 http://localhost:3000，网页与扩展通信正常。')
  host = document.createElement('section'); document.body.append(host)
})
afterEach(() => { host.remove(); vi.unstubAllGlobals() })
async function mount() { mountWorkbenchPopup(host); await vi.waitFor(() => expect(button().disabled).toBe(false)) }
it('连接当前窗口的工作台，持续展示结果，不受其他窗口最近访问影响', async () => {
  await mount()
  expect(host.textContent).toContain(`工作台：${current.url}`)
  const initial = button(); initial.click()
  await vi.waitFor(() => expect(host.textContent).toContain('已连接 http://localhost:3000'))
  expect(connectWorkbench).toHaveBeenCalledWith(current, expect.objectContaining({ onProgress: expect.any(Function) }))
  expect(button()).toBe(initial)
})
it('已有访问权限时自动恢复通信，无需再次点击连接', async () => {
  fake.permissions.contains.mockResolvedValue(true)
  await mount()
  expect(connectWorkbench).toHaveBeenCalledWith(current, expect.objectContaining({ requestAccess: false }))
  expect(host.textContent).toContain('已连接')
})
it('连接中明确显示当前阶段；失败提示保持可见，允许重试', async () => {
  let reject!: (error: Error) => void
  vi.mocked(connectWorkbench).mockImplementationOnce((_tab, options) => {
    options?.onProgress?.('正在加载网页通信脚本…')
    return new Promise((_resolve, fail) => { reject = fail })
  })
  await mount(); button().click()
  expect(button().disabled).toBe(true)
  expect(host.textContent).toContain('正在加载网页通信脚本')
  reject(new Error('没有注入权限'))
  await vi.waitFor(() => expect(button().disabled).toBe(false))
  expect(host.querySelector('[role=status]')!.textContent).toBe('没有注入权限')
  button().click()
  await vi.waitFor(() => expect(host.textContent).toContain('已连接'))
})
