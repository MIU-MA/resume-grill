// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const runtime = {
  lastError: undefined as { message: string } | undefined,
  sendMessage: vi.fn((_request: unknown, callback: (response: unknown) => void) => callback({ ok: true, data: null })),
}
let listeners: EventListener[]
const request = (type = 'snapshot', origin = location.origin) => window.dispatchEvent(new MessageEvent('message', { source: window, origin, data: { channel: 'resume-grill.website.request', requestId: 'request-1', type } }))
beforeEach(() => {
  vi.resetModules(); runtime.lastError = undefined
  runtime.sendMessage.mockReset().mockImplementation((_request, callback) => callback({ ok: true, data: null }))
  vi.stubGlobal('chrome', { runtime })
  listeners = []
  const add = window.addEventListener.bind(window)
  vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
    if (type === 'message') listeners.push(listener as EventListener)
    add(type, listener, options)
  })
  vi.spyOn(window, 'postMessage').mockImplementation(() => undefined)
})
afterEach(() => {
  for (const listener of listeners) window.removeEventListener('message', listener)
  history.replaceState(null, '', '/')
  vi.restoreAllMocks(); vi.unstubAllGlobals()
})
it('从诊断页加载后切换到投递清单，仍能与扩展通信', async () => {
  history.replaceState(null, '', '/diagnosis')
  await import('./bridge')
  expect(window.postMessage).toHaveBeenCalledWith({ channel: 'resume-grill.website.ready', url: location.href }, location.origin)
  request('ping')
  history.pushState(null, '', '/applications')
  request()
  expect(runtime.sendMessage).toHaveBeenCalledTimes(2)
  expect(window.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ requestId: 'request-1', response: { ok: true, data: null } }), location.origin)
})
it('加载时在其他路径也监听导航后的合法工作台请求，但不转发非法路径与来源', async () => {
  history.replaceState(null, '', '/unknown')
  await import('./bridge'); request()
  expect(runtime.sendMessage).not.toHaveBeenCalled()
  history.pushState(null, '', '/applications')
  request('snapshot', 'https://evil.example'); request('command')
  expect(runtime.sendMessage).not.toHaveBeenCalled()
  request()
  expect(runtime.sendMessage).toHaveBeenCalledOnce()
})
it('扩展重新加载使旧页面的运行时失效时，返回刷新提示而不是丢失请求', async () => {
  await import('./bridge')
  runtime.sendMessage.mockImplementationOnce(() => { throw new Error('Extension context invalidated.') })
  request()
  expect(window.postMessage).toHaveBeenCalledWith(expect.objectContaining({ response: { ok: false, error: expect.stringContaining('连接已失效') } }), location.origin)
})
it('后台通信错误保留具体原因', async () => {
  await import('./bridge')
  runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' }
  request()
  expect(window.postMessage).toHaveBeenCalledWith(expect.objectContaining({ response: { ok: false, error: expect.stringContaining('Receiving end does not exist') } }), location.origin)
})
it('重复注入会替换旧监听器，不重复交接同一批任务', async () => {
  await import('./bridge')
  vi.resetModules()
  await import('./bridge')
  request('stage')
  expect(runtime.sendMessage).toHaveBeenCalledOnce()
})
