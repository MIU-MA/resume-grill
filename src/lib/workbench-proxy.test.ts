import { afterEach, expect, it, vi } from 'vitest'
import { proxyResumeSnapshot } from './workbench-proxy'
import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'
import { NodeNextRequest } from 'next/dist/server/base-http/node'
import { NextRequestAdapter } from 'next/dist/server/web/spec-extension/adapters/next-request'
import { addRequestMeta } from 'next/dist/server/request-meta'

const token = 'a-test-secret-at-least-thirty-two-characters'
const snapshot = { sourceName: '简历.pdf', rawText: '姓名\n项目内容' }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })
function request(body = snapshot, origin = 'http://localhost:3000') {
  return new Request('http://localhost:3000/api/local-resumes', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

it('仅转发到固定本机端口，令牌只放上游请求头', async () => {
  vi.stubEnv('WORKBENCH_TOKEN', token)
  vi.stubEnv('WORKBENCH_PORT', '3110')
  const fetcher = vi.fn().mockResolvedValue(Response.json({ ...snapshot, id: 'a'.repeat(32), createdAt: 1 }, { status: 201 }))
  vi.stubGlobal('fetch', fetcher)
  const response = await proxyResumeSnapshot(request())
  expect(response.status).toBe(201)
  expect(fetcher).toHaveBeenCalledWith('http://127.0.0.1:3110/v1/resumes', expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${token}` }), body: JSON.stringify(snapshot), redirect: 'error' }))
  expect(await response.text()).not.toContain(token)
  expect(response.headers.get('cache-control')).toBe('no-store')
})

it('阻止外部站点、非本机工作台、归属注入和路径注入', async () => {
  vi.stubEnv('WORKBENCH_TOKEN', token)
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  expect((await proxyResumeSnapshot(request(snapshot, 'https://evil.example'))).status).toBe(403)
  expect((await proxyResumeSnapshot(new Request('https://public.example/api/local-resumes'))).status).toBe(403)
  expect((await proxyResumeSnapshot(new Request('http://localhost:3000/api/local-resumes', { headers: { 'Sec-Fetch-Site': 'cross-site' } }))).status).toBe(403)
  expect((await proxyResumeSnapshot(new Request('http://localhost:3000/api/local-resumes'), '../secret')).status).toBe(400)
  expect((await proxyResumeSnapshot(request({ ...snapshot, owner: 'bob' } as typeof snapshot))).status).toBe(400)
  expect(fetcher).not.toHaveBeenCalled()
})

it('连接失败、令牌不一致和未配置均返回可理解的错误', async () => {
  vi.stubEnv('WORKBENCH_TOKEN', '')
  expect((await proxyResumeSnapshot(request())).status).toBe(503)
  vi.stubEnv('WORKBENCH_TOKEN', token)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private detail', { status: 401 })))
  const denied = await proxyResumeSnapshot(request())
  expect(denied.status).toBe(502)
  expect(await denied.text()).toContain('令牌不一致')
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private path')))
  const failed = await proxyResumeSnapshot(request())
  expect(failed.status).toBe(503)
  expect(await failed.text()).not.toContain('private')
})

it('未声明长度的超大请求也会在转发前拒绝', async () => {
  vi.stubEnv('WORKBENCH_TOKEN', token)
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const large = request({ ...snapshot, rawText: 'x'.repeat(2 * 1024 * 1024) })
  expect((await proxyResumeSnapshot(large)).status).toBe(413)
  expect(fetcher).not.toHaveBeenCalled()
})

it('请求体未结束时取消操作，应及时停止读取且不向 Go 提交', async () => {
  vi.stubEnv('WORKBENCH_TOKEN', token)
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const abort = new AbortController()
  let controller!: ReadableStreamDefaultController<Uint8Array>
  const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value } })
  const input = new Request('http://localhost:3000/api/local-resumes', {
    method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
    body: stream, signal: abort.signal, duplex: 'half',
  } as RequestInit)
  const result = proxyResumeSnapshot(input)
  abort.abort()
  try {
    const response = await Promise.race([result, new Promise<null>(done => setTimeout(() => done(null), 100))])
    expect(response?.status).toBe(408)
    expect(fetcher).not.toHaveBeenCalled()
  } finally { try { controller.error(new Error('test cleanup')) } catch { /* Already cancelled. */ } }
})

it('上游错误响应的流清理失败，仍保留已经确认的令牌错误', async () => {
  vi.stubEnv('WORKBENCH_TOKEN', token)
  const body = new ReadableStream({ cancel() { return Promise.reject(new Error('cleanup failure')) } })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 401 })))
  const response = await proxyResumeSnapshot(request())
  expect(response.status).toBe(502)
  expect(await response.text()).toContain('令牌不一致')
})

it('请求体读取期限到达时取消流并拒绝提交', async () => {
  vi.stubEnv('WORKBENCH_TOKEN', token)
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  const deadline = new AbortController()
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
  const cancel = vi.fn()
  const input = new Request('http://localhost:3000/api/local-resumes', {
    method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
    body: new ReadableStream({ cancel }), duplex: 'half',
  } as RequestInit)
  const result = proxyResumeSnapshot(input)
  deadline.abort(new DOMException('timeout', 'TimeoutError'))
  expect((await result).status).toBe(408)
  expect(cancel).toHaveBeenCalledOnce()
  expect(fetcher).not.toHaveBeenCalled()
})

it('等待上游响应体时取消操作，会停止读取并提示核对保存结果', async () => {
  vi.stubEnv('WORKBENCH_TOKEN', token)
  const cancel = vi.fn()
  const abort = new AbortController()
  let fetched!: () => void
  const received = new Promise<void>(done => { fetched = done })
  vi.stubGlobal('fetch', vi.fn(async () => { fetched(); return new Response(new ReadableStream({ cancel }), { status: 201 }) }))
  const input = new Request(request(), { signal: abort.signal })
  const result = proxyResumeSnapshot(input)
  await received
  abort.abort()
  const response = await result
  expect(response.status).toBe(503)
  expect(await response.text()).toContain('核对')
  expect(cancel).toHaveBeenCalledOnce()
})

it('配置中含空白或非 ASCII 字符的令牌在发起请求前报错', async () => {
  const fetcher = vi.fn()
  vi.stubGlobal('fetch', fetcher)
  for (const value of [token + ' ', token + '\n', '中文'.repeat(32)]) {
    vi.stubEnv('WORKBENCH_TOKEN', value)
    const response = await proxyResumeSnapshot(request())
    expect(response.status).toBe(503)
    expect(await response.text()).toContain('令牌')
  }
  expect(fetcher).not.toHaveBeenCalled()
})

it('通过真实 Next.js 请求适配器时仍能识别浏览器的本机同源请求', async () => {
  vi.stubEnv('WORKBENCH_TOKEN', token)
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ...snapshot, id: 'a'.repeat(32), createdAt: 1 }, { status: 201 })))
  const socket = new Socket()
  const incoming = new IncomingMessage(socket)
  incoming.method = 'POST'; incoming.url = '/api/local-resumes'
  incoming.headers = { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' }
  incoming.push(Buffer.from(JSON.stringify(snapshot))); incoming.push(null)
  const nodeRequest = new NodeNextRequest(incoming)
  addRequestMeta(nodeRequest, 'initURL', 'http://127.0.0.1:3000/api/local-resumes')
  const input = NextRequestAdapter.fromNodeNextRequest(nodeRequest, new AbortController().signal)
  try {
    expect(new URL(input.url).hostname).toBe('localhost')
    expect((await proxyResumeSnapshot(input)).status).toBe(201)
  } finally { socket.destroy() }
})
