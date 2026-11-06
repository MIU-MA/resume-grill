// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useMailAgent } from './use-mail-agent'
let root: Root, host: HTMLDivElement, agent: ReturnType<typeof useMailAgent>
function Harness() { agent = useMailAgent(); return null }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); window.sessionStorage.clear()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })
it.each(['success', 'unauthorized', 'network'])('旧轮询不能覆盖已成功操作的状态：%s', async outcome => {
  let resolve!: (value: Response) => void
  let reject!: (error: Error) => void
  const configured = { jobs: [], sender: { name: '演示', address: 'demo@example.com' } }
  const fetchMock = vi.fn((url: string) => url.endsWith('/status') ? new Promise<Response>((done, fail) => { resolve = done; reject = fail }) : Promise.resolve(Response.json(configured)))
  vi.stubGlobal('fetch', fetchMock)
  await act(async () => root.render(createElement(Harness)))
  let polling!: ReturnType<typeof agent.refresh>
  await act(async () => { polling = agent.refresh() })
  await act(async () => { await agent.command('/configure', {}) })
  await act(async () => {
    if (outcome === 'network') reject(new Error('offline'))
    else resolve(Response.json(outcome === 'success' ? { jobs: [], sender: null } : { error: 'expired' }, { status: outcome === 'unauthorized' ? 401 : 200 }))
    await polling
  })
  expect(agent.snapshot?.sender?.address).toBe('demo@example.com'); expect(agent.connectionError).toBe('')
})
it('操作进行中暂停轮询，结束后可读取新状态', async () => {
  let resolve!: (value: Response) => void
  const fetchMock = vi.fn((url: string) => url.endsWith('/configure') ? new Promise<Response>(done => { resolve = done }) : Promise.resolve(Response.json({ jobs: [], sender: null, paused: true })))
  vi.stubGlobal('fetch', fetchMock)
  await act(async () => root.render(createElement(Harness)))
  let command!: ReturnType<typeof agent.command>
  await act(async () => { command = agent.command('/configure', {}) })
  await act(async () => { expect(await agent.refresh()).toBeNull() })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  await act(async () => { resolve(Response.json({ jobs: [], sender: null })); await command })
  await act(async () => { await agent.refresh() })
  expect(agent.snapshot?.paused).toBe(true)
})
it('主动断开后忽略迟到的连接成功结果', async () => {
  let resolve!: (value: Response) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(done => { resolve = done })))
  await act(async () => root.render(createElement(Harness)))
  let connecting!: Promise<void>
  await act(async () => { connecting = agent.connect('pending-token') })
  await act(async () => agent.forgetConnection())
  await act(async () => { resolve(Response.json({ jobs: [], sender: null })); await connecting })
  expect(agent.token).toBe(''); expect(agent.snapshot).toBeNull()
  expect(sessionStorage.getItem('mail-workbench:connection')).toBeNull()
})
it('旧执行器只接受 url：已连接旧服务时不发送新字段，原抓取不会因关键词被 400 拒绝', async () => {
  vi.useFakeTimers()
  const bodies: unknown[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    if (url.endsWith('/status')) return Response.json({ jobs: [], sender: null })
    const body = JSON.parse(String(options.body)); bodies.push(body)
    if (Object.keys(body).some(key => key !== 'url')) return Response.json({ error: 'unrecognized keys' }, { status: 400 })
    return Response.json({ pagesRead: 1, links: [], pages: [{ role: '后端研发', url: 'https://example.com/jobs/1' }] })
  }))
  await act(async () => root.render(createElement(Harness)))
  await act(async () => { await agent.connect('TEST-OLD-PAIRING') })
  let result: { pages: Array<{ role: string }> } | undefined
  await act(async () => { result = await agent.request('/discover', { url: 'https://example.com/', keywords: ['后端'] }) })
  expect(bodies).toEqual([{ url: 'https://example.com/' }])
  expect(result?.pages[0].role).toBe('后端研发')
  expect(agent.readerWarning).toContain('旧版执行器')
})
it('新版执行器明确支持动态读取时才发送关键词', async () => {
  vi.useFakeTimers(); const bodies: unknown[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    if (url.endsWith('/status')) return Response.json({ jobs: [], sender: null, capabilities: { careerReader: 'dynamic-v1' } })
    bodies.push(JSON.parse(String(options.body))); return Response.json({ links: [], pagesRead: 1, notes: [] })
  }))
  await act(async () => root.render(createElement(Harness)))
  await act(async () => { await agent.connect('TEST-NEW-PAIRING') })
  await act(async () => { await agent.request('/discover', { url: 'https://example.com/', keywords: ['后端'] }) })
  expect(bodies).toEqual([{ url: 'https://example.com/', keywords: ['后端'] }])
  expect(agent.readerWarning).toBe('')
})
it('新版读取真正失败时保留错误，不会去掉关键词重复请求或误报旧版', async () => {
  vi.useFakeTimers(); const requests: unknown[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: RequestInit) => {
    if (url.endsWith('/status')) return Response.json({ jobs: [], sender: null, capabilities: { careerReader: 'dynamic-v1' } })
    requests.push(JSON.parse(String(options.body))); return Response.json({ error: '官网读取失败' }, { status: 400 })
  }))
  await act(async () => root.render(createElement(Harness)))
  await act(async () => { await agent.connect('TEST-NEW-PAIRING') })
  await act(async () => { await expect(agent.request('/discover', { url: 'https://example.com/', keywords: ['后端'] })).rejects.toThrow('官网读取失败') })
  expect(requests).toHaveLength(1)
  expect(agent.readerWarning).toBe('')
})
it('未知版本读取被拒绝时只兼容重试一次，配置或发邮件失败绝不自动重试', async () => {
  const bodies: unknown[] = []
  const mock = vi.fn(async (url: string, options: RequestInit) => {
    const body = JSON.parse(String(options.body)); bodies.push(body)
    return url.endsWith('/discover') && !('keywords' in body) ? Response.json({ pagesRead: 1, links: [] }) : Response.json({ error: 'invalid request' }, { status: 400 })
  })
  vi.stubGlobal('fetch', mock)
  await act(async () => root.render(createElement(Harness)))
  await act(async () => { await agent.request('/discover', { url: 'https://example.com/', keywords: ['后端'] }, 'TEST-ONLY') })
  expect(bodies).toHaveLength(2)
  mock.mockClear()
  await act(async () => { await expect(agent.command('/configure', { url: 'https://example.com/', keywords: ['ignored'] })).rejects.toThrow('invalid request') })
  expect(mock).toHaveBeenCalledOnce()
})
it('重启后的旧连接码自动清理；新配对读取已恢复的邮箱，不要求再填写授权码', async () => {
  vi.useFakeTimers(); window.sessionStorage.setItem('mail-workbench:connection', 'expired-test-token')
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ error: 'old pairing' }, { status: 401 }))
  const restored = { jobs: [], sender: { name: '测试用户', address: 'candidate@163.com' }, credentials: { supported: true, saved: true, restoring: false } }
  fetchMock.mockResolvedValue(Response.json(restored)); vi.stubGlobal('fetch', fetchMock)
  await act(async () => root.render(createElement(Harness)))
  expect(agent.token).toBe('')
  expect(window.sessionStorage.getItem('mail-workbench:connection')).toBeNull()
  expect(agent.connectionError).toContain('邮箱授权码无需重新填写')
  const calls = fetchMock.mock.calls.length
  await act(async () => { await vi.advanceTimersByTimeAsync(10000) })
  expect(fetchMock).toHaveBeenCalledTimes(calls)
  // Each mock response needs its own body stream, just like real HTTP responses.
  fetchMock.mockImplementation(async () => Response.json(restored))
  await act(async () => { await agent.connect('new-test-pairing') })
  expect(agent.snapshot?.credentials?.saved).toBe(true)
  expect(agent.snapshot?.sender?.address).toBe('candidate@163.com')
  expect(fetchMock.mock.calls.every((call: unknown[]) => !String(call[0]).includes('/configure'))).toBe(true)
})
