// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { connectWorkbench, probeWorkbench } from './workbench-connection'

const tab = { id: 7, url: 'http://localhost:3000/applications' } as chrome.tabs.Tab
const fake = {
  permissions: { request: vi.fn(async (_input: unknown) => true), contains: vi.fn(async (_input: unknown) => true) },
  tabs: { get: vi.fn(async (_id: number) => tab) },
  scripting: { executeScript: vi.fn(async (_input: unknown) => [{ frameId: 0, result: { ok: true } }]) },
}
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal('chrome', fake)
  fake.permissions.request.mockResolvedValue(true); fake.tabs.get.mockResolvedValue(tab)
  fake.scripting.executeScript.mockResolvedValue([{ frameId: 0, result: { ok: true } }])
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })
it('点击时先申请当前本机来源，再注入通信脚本并从网页环境检查完整往返', async () => {
  const pending = connectWorkbench(tab)
  expect(fake.permissions.request).toHaveBeenCalledWith({ origins: ['http://localhost:3000/*'] })
  expect(fake.tabs.get).not.toHaveBeenCalled()
  expect(await pending).toContain('已连接')
  expect(fake.scripting.executeScript).toHaveBeenNthCalledWith(1, { target: { tabId: 7, frameIds: [0] }, files: ['bridge.js'] })
  expect(fake.scripting.executeScript).toHaveBeenNthCalledWith(2, { target: { tabId: 7, frameIds: [0] }, world: 'MAIN', func: probeWorkbench, args: [tab.url] })
})
it('恢复已有权限时不弹授权框，并明确报告连接阶段', async () => {
  const onProgress = vi.fn()
  expect(await connectWorkbench(tab, { requestAccess: false, onProgress })).toContain('已连接')
  expect(fake.permissions.request).not.toHaveBeenCalled()
  expect(fake.permissions.contains).toHaveBeenCalledWith({ origins: ['http://localhost:3000/*'] })
  expect(onProgress.mock.calls.flat()).toEqual(['正在检查工作台访问权限…', '正在加载网页通信脚本…', '正在等待工作台与扩展互相回应…'])
})
it('未授权或页面跳转时不注入，不接触其他网站', async () => {
  await expect(connectWorkbench({ ...tab, url: 'https://example.com' })).rejects.toThrow('本机工作台')
  expect(fake.permissions.request).not.toHaveBeenCalled()
  fake.permissions.request.mockResolvedValue(false)
  await expect(connectWorkbench(tab)).rejects.toThrow('未允许')
  fake.permissions.request.mockResolvedValue(true)
  fake.tabs.get.mockResolvedValue({ ...tab, url: 'https://example.com' })
  await expect(connectWorkbench(tab)).rejects.toThrow('跳转')
  expect(fake.scripting.executeScript).not.toHaveBeenCalled()
})
it('脚本注入成功但网页未回应时，不报告已连接', async () => {
  fake.scripting.executeScript.mockResolvedValueOnce([{ frameId: 0, result: { ok: true } }]).mockResolvedValueOnce([{ frameId: 0, result: { ok: false } }])
  await expect(connectWorkbench(tab)).rejects.toThrow('未能检查')
})
it('网页检查只接受同来源、同窗口和同一次请求的后台回应', async () => {
  vi.useFakeTimers()
  const post = vi.spyOn(window, 'postMessage').mockImplementation(() => {})
  const pending = probeWorkbench(location.href)
  const request = post.mock.calls[0][0] as { requestId: string; type: string }
  expect(request.type).toBe('ping')
  const data = { channel: 'resume-grill.website.response', requestId: request.requestId, response: { ok: true } }
  let settled = false; void pending.then(() => { settled = true })
  window.dispatchEvent(new MessageEvent('message', { source: window, origin: 'https://other.example', data }))
  await Promise.resolve(); expect(settled).toBe(false)
  window.dispatchEvent(new MessageEvent('message', { source: window, origin: location.origin, data }))
  expect(await pending).toEqual({ ok: true }); expect(vi.getTimerCount()).toBe(0)
})
it('检查超时明确指出脚本已注入但消息没有往返', async () => {
  vi.useFakeTimers(); vi.spyOn(window, 'postMessage').mockImplementation(() => {})
  const pending = probeWorkbench(location.href)
  await vi.advanceTimersByTimeAsync(10000)
  expect(await pending).toMatchObject({ ok: false, error: expect.stringContaining('通信脚本已加载') })
  expect(vi.getTimerCount()).toBe(0)
})
