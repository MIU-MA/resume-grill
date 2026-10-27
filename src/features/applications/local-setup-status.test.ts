// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LocalSetupStatus } from './LocalSetupStatus'
import { extensionRequest } from './website-automation'
vi.mock('./website-automation', () => ({ extensionRequest: vi.fn() }))
vi.mock('@/domain/website-automation', () => ({ isWorkbenchUrl: () => true }))
let root: Root
let host: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  vi.mocked(extensionRequest).mockResolvedValue({})
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); vi.clearAllMocks() })
it('分别显示执行器和扩展的真实连接状态，不要求先配置邮箱', async () => {
  const onConnect = vi.fn()
  await act(async () => root.render(createElement(LocalSetupStatus, { connected: false, connectionError: '', onConnect })))
  expect(host.querySelector('summary')!.textContent).toContain('执行器未连接 · 扩展已连接')
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === '连接本机')!.click())
  expect(onConnect).toHaveBeenCalledOnce()
  expect(extensionRequest).toHaveBeenCalledWith('ping')
})
it('检测失败不会声称扩展未安装；重新检测后更新状态', async () => {
  vi.mocked(extensionRequest).mockRejectedValueOnce(new Error('timeout'))
  await act(async () => root.render(createElement(LocalSetupStatus, { connected: true, connectionError: '', onConnect: vi.fn() })))
  expect(host.querySelector('summary')!.textContent).toContain('执行器已连接 · 扩展未连接')
  expect(host.textContent).toContain('timeout')
  expect([...host.querySelectorAll('button')].some(button => button.textContent === '刷新工作台')).toBe(true)
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === '重新检测')!.click())
  expect(host.querySelector('summary')!.textContent).toContain('扩展已连接')
})
it('扩展重新注入后自动核实连接，不把脚本就绪通知直接当作成功', async () => {
  vi.mocked(extensionRequest).mockRejectedValueOnce(new Error('timeout'))
  await act(async () => root.render(createElement(LocalSetupStatus, { connected: true, connectionError: '', onConnect: vi.fn() })))
  const announce = (origin = location.origin, url = location.href) => window.dispatchEvent(new MessageEvent('message', { source: window, origin, data: { channel: 'resume-grill.website.ready', url } }))
  await act(async () => { announce('https://other.example'); announce(location.origin, 'http://localhost:3000/other') })
  expect(extensionRequest).toHaveBeenCalledTimes(1)
  vi.mocked(extensionRequest).mockRejectedValueOnce(new Error('后台未回应'))
  await act(async () => { announce() })
  expect(extensionRequest).toHaveBeenCalledTimes(2)
  expect(host.querySelector('summary')!.textContent).toContain('扩展未连接')
  await act(async () => { announce() })
  expect(host.querySelector('summary')!.textContent).toContain('扩展已连接')
  expect(host.textContent).not.toContain('后台未回应')
})
