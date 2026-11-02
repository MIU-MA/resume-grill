import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { assertAllowedBaseUrl } from '@/lib/url-guard'
import { rateLimit } from '@/lib/server-limits'
import { handleModelList } from './model-list-api'

vi.mock('@/lib/url-guard', () => ({ assertAllowedBaseUrl: vi.fn(async () => undefined) }))
vi.mock('@/lib/server-limits', () => ({ getClientIp: () => 'test', rateLimit: vi.fn(() => ({ ok: true, retryAfter: 1 })), withTimeout: () => new AbortController().signal }))
const request = (body = { baseUrl: 'https://models.example/v1/', apiKey: 'private-test-key' }) => new Request('http://localhost/api/models', { method: 'POST', body: JSON.stringify(body) })
beforeEach(() => { vi.clearAllMocks(); vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfter: 1 }); vi.mocked(assertAllowedBaseUrl).mockResolvedValue(undefined) })
afterEach(() => vi.unstubAllGlobals())
it('只请求当前服务的模型清单，去重并保留提供方的精确 ID', async () => {
  const fetchMock = vi.fn(async () => Response.json({ data: [{ id: 'full/model:latest' }, { id: 'new-model' }, { id: 'new-model' }] }))
  vi.stubGlobal('fetch', fetchMock)
  const response = await handleModelList(request())
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ models: ['full/model:latest', 'new-model'] })
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(assertAllowedBaseUrl).toHaveBeenCalledWith('https://models.example/v1')
  expect(fetchMock).toHaveBeenCalledWith('https://models.example/v1/models', expect.objectContaining({ redirect: 'error', cache: 'no-store', headers: { Authorization: 'Bearer private-test-key' } }))
})
it('无效、过大请求和被禁止地址均不能发起上游请求', async () => {
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
  expect((await handleModelList(request({ baseUrl: '', apiKey: '' }))).status).toBe(400)
  expect((await handleModelList(request({ baseUrl: 'x'.repeat(17000), apiKey: 'key' }))).status).toBe(400)
  expect((await handleModelList(request({ baseUrl: 'https://models.example/v1?key=secret', apiKey: 'key' }))).status).toBe(400)
  vi.mocked(assertAllowedBaseUrl).mockRejectedValueOnce(new Error('blocked'))
  expect((await handleModelList(request())).status).toBe(400)
  expect(fetchMock).not.toHaveBeenCalled()
})
it.each([401, 403, 404, 405, 429, 500])('上游 %s 返回可操作提示，不泄漏上游响应和密钥', async status => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('private-test-key', { status })))
  const response = await handleModelList(request())
  expect(response.status).toBe(502)
  expect(await response.text()).not.toContain('private-test-key')
})
it('不支持列表或网络失败时保留手动填写入口，不伪造可用模型', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ models: ['wrong-format'] })).mockRejectedValueOnce(new Error('timeout'))
  vi.stubGlobal('fetch', fetchMock)
  expect((await handleModelList(request())).status).toBe(502)
  expect((await handleModelList(request())).status).toBe(502)
})
it('服务端限流时不请求上游', async () => {
  vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 8 })
  const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
  expect((await handleModelList(request())).status).toBe(429)
  expect(fetchMock).not.toHaveBeenCalled()
})
