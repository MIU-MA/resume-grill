import { afterEach, expect, it, vi } from 'vitest'
import { connectChromeSocket, parseChromeDebugEndpoint } from './chrome-connection'
import { createServer } from 'node:http'
class Socket extends EventTarget { readyState = 0; close = vi.fn(() => { this.readyState = 3 }) }
afterEach(() => vi.useRealTimers())
it('校验调试文件，拒绝无效端口和路径', () => {
  expect(parseChromeDebugEndpoint('9222\n/devtools/browser/test-id\n')).toBe('ws://127.0.0.1:9222/devtools/browser/test-id')
  for (const text of ['0\n/devtools/browser/test', '99999\n/devtools/browser/test', '9222\nhttps://evil.com/']) expect(() => parseChromeDebugEndpoint(text)).toThrow('地址无效')
})
it('授权等待期间保持同一个连接，不自动重复请求', async () => {
  vi.useFakeTimers()
  const socket = new Socket(), factory = vi.fn(() => socket as unknown as WebSocket)
  const result = connectChromeSocket(new URL('ws://127.0.0.1:9222/devtools/browser/test'), factory)
  await vi.advanceTimersByTimeAsync(10000)
  expect(factory).toHaveBeenCalledTimes(1); expect(socket.close).not.toHaveBeenCalled()
  socket.readyState = 1; socket.dispatchEvent(new Event('open'))
  expect(await result).toBe(socket)
  await vi.advanceTimersByTimeAsync(180000)
  expect(socket.close).not.toHaveBeenCalled()
})
it('授权前关闭及时返回，错误和超时会释放未建立的连接', async () => {
  vi.useFakeTimers()
  for (const event of ['close', 'error', 'timeout']) {
    const socket = new Socket()
    const pending = connectChromeSocket(new URL('ws://127.0.0.1:9222/devtools/browser/test'), () => socket as unknown as WebSocket, 100)
    const check = expect(pending).rejects.toThrow(event === 'close' ? '授权完成前关闭' : event === 'error' ? '未接受调试连接' : '授权超时')
    if (event === 'timeout') await vi.advanceTimersByTimeAsync(101)
    else socket.dispatchEvent(new Event(event))
    await check
    expect(socket.close).toHaveBeenCalledTimes(1)
  }
})
it('真实 WebSocket 握手被拒绝时返回明确错误并结束连接', async () => {
  const server = createServer((_request, response) => { response.writeHead(403); response.end() })
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  const address = server.address() as { port: number }
  try { await expect(connectChromeSocket(new URL(`ws://127.0.0.1:${address.port}/devtools/browser/test`))).rejects.toThrow('Chrome 未接受调试连接') }
  finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())) }
})
