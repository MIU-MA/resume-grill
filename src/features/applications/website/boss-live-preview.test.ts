// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { BossLivePreview } from './BossLivePreview'

let host: HTMLDivElement, root: ReturnType<typeof createRoot>
const connection = { origin: 'http://127.0.0.1:4327', token: 'a'.repeat(48) }
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['jpeg'], { type: 'image/jpeg' }), { headers: { 'Content-Type': 'image/jpeg' } })))
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })
async function render(connected = true) {
  await act(async () => root.render(createElement(BossLivePreview, { connection, connected })))
  if (connected) await act(async () => host.querySelector('iframe')!.dispatchEvent(new Event('load')))
}
async function click() { await act(async () => host.querySelector('button')!.click()) }
it('主动开始后更新，暂停取消请求和定时器，iframe 不接收凭据', async () => {
  await render()
  expect(fetch).not.toHaveBeenCalled()
  const receiver = vi.spyOn(host.querySelector('iframe')!.contentWindow!, 'postMessage')
  await click()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(host.textContent).toContain('约每秒一帧')
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(JSON.stringify(receiver.mock.calls)).not.toContain(connection.token)
  expect(host.querySelector('iframe')!.srcdoc).not.toContain(connection.token)
  await click()
  await act(async () => vi.advanceTimersByTimeAsync(5000))
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(host.textContent).toContain('显示最后一帧')
})
it('慢请求期间不积压后续请求，断开后丢弃迟到画面', async () => {
  let finish!: (response: Response) => void
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await render(); const receiver = vi.spyOn(host.querySelector('iframe')!.contentWindow!, 'postMessage')
  await click()
  await act(async () => vi.advanceTimersByTimeAsync(5000))
  expect(fetch).toHaveBeenCalledTimes(1)
  await render(false)
  expect(host.querySelector('iframe')).toBeNull()
  await act(async () => finish(new Response('jpeg', { headers: { 'Content-Type': 'image/jpeg' } })))
  expect(receiver).not.toHaveBeenCalled()
})
it('批次切换后台页时保留画面并继续，真正的断开仍停止采集', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ code: 'FRAME_SWITCH' }), { status: 409 }))
  await render(); await click()
  expect(host.textContent).toContain('正在读取画面')
  expect(host.querySelector('[role=alert]')).toBeNull()
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(host.textContent).toContain('约每秒一帧')
})
it('错误后停止，不静默重试；隐藏工作台标签页时暂停', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: '页面已关闭' }), { status: 503 }))
  await render(); await click()
  expect(host.textContent).toContain('页面已关闭')
  await act(async () => vi.advanceTimersByTimeAsync(5000))
  expect(fetch).toHaveBeenCalledTimes(1)
  await click()
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
  await act(async () => document.dispatchEvent(new Event('visibilitychange')))
  await act(async () => vi.advanceTimersByTimeAsync(5000))
  expect(fetch).toHaveBeenCalledTimes(2)
  expect(host.textContent).toContain('标签页不可见')
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})
