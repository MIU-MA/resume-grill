// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LocalSetupStatus } from './LocalSetupStatus'
import { extensionRequest } from '../applications/website/lib/website-automation'
vi.mock('../applications/website/lib/website-automation', () => ({ extensionRequest: vi.fn() }))
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
  expect(host.querySelector('[role="status"]')!.textContent).toContain('执行器未连接扩展已连接')
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === '连接本机')!.click())
  expect(onConnect).toHaveBeenCalledOnce()
  expect(extensionRequest).toHaveBeenCalledWith('ping', undefined, expect.objectContaining({ onProgress: expect.any(Function), signal: expect.any(AbortSignal) }))
})
it('检测失败不会声称扩展未安装；重新检测后更新状态', async () => {
  vi.mocked(extensionRequest).mockRejectedValueOnce(new Error('timeout'))
  await act(async () => root.render(createElement(LocalSetupStatus, { connected: true, connectionError: '', onConnect: vi.fn() })))
  expect(host.querySelector('[role="status"]')!.textContent).toContain('执行器已连接扩展未连接')
  expect(host.textContent).toContain('timeout')
  expect(host.querySelector('details')!.open).toBe(false)
  expect([...host.querySelectorAll('button')].some(button => button.textContent === '刷新工作台')).toBe(true)
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === '重新检测')!.click())
  expect(host.querySelector('[role="status"]')!.textContent).toContain('扩展已连接')
})
it('保留脚本接收和后台超时过程，可复制版本、地址和断点', async () => {
  const copy = vi.fn(async () => {})
  vi.stubGlobal('navigator', { clipboard: { writeText: copy } })
  vi.mocked(extensionRequest).mockImplementationOnce(async (_type, _batch, options) => {
    options?.onProgress?.({ step: 'request', detail: '工作台已发出检测请求' })
    options?.onProgress?.({ step: 'bridge', detail: '通信脚本已收到请求', extensionVersion: '0.2.3', extensionId: 'test-extension' })
    options?.onProgress?.({ step: 'error', detail: '[RG-BACKGROUND] 后台未回应', extensionVersion: '0.2.3', extensionId: 'test-extension' })
    throw new Error('[RG-BACKGROUND] 后台未回应')
  })
  await act(async () => root.render(createElement(LocalSetupStatus, { connected: false, connectionError: '', onConnect: vi.fn() })))
  expect(host.textContent).toContain('v0.2.3')
  expect(host.querySelector('[aria-label="扩展连接检查"]')!.textContent).toContain('通信脚本已收到请求')
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === '复制诊断信息')!.click())
  expect(copy.mock.calls[0][0]).toContain('[RG-BACKGROUND]')
  expect(copy.mock.calls[0][0]).toContain('test-extension')
  expect(copy.mock.calls[0][0]).toContain('http://localhost:3000/')
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
  expect(host.querySelector('[role="status"]')!.textContent).toContain('扩展未连接')
  await act(async () => { announce() })
  expect(host.querySelector('[role="status"]')!.textContent).toContain('扩展已连接')
  expect(host.textContent).not.toContain('后台未回应')
})
