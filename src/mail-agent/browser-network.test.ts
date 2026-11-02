import { EventEmitter } from 'node:events'
import { gzipSync } from 'node:zlib'
import { request } from 'node:https'
import { afterEach, expect, it, vi } from 'vitest'
import { readBrowserResource } from './browser-network'
import { browserRequestAllowed, trustedPublicBrowserHost } from './browser-origins'
vi.mock('node:https', () => ({ request: vi.fn() }))
afterEach(() => vi.clearAllMocks())
it('浏览器公开域名匹配有域名边界，禁止内网、HTTP、非读取方法和申请提交', () => {
  expect(trustedPublicBrowserHost('jobs.bytedance.com')).toBe(true)
  expect(trustedPublicBrowserHost('jobs.bytedance.com.evil.test')).toBe(false)
  expect(trustedPublicBrowserHost('fakebytedance.com')).toBe(false)
  for (const [url, method] of [['http://example.com/jobs', 'GET'], ['https://example.com/apply', 'POST'], ['https://example.com/jobs', 'DELETE']]) expect(browserRequestAllowed(new URL(url), method, 0)).toBe(false)
  expect(browserRequestAllowed(new URL('https://example.com/api/search'), 'POST', 10)).toBe(true)
})
it('未知站点的 HTTPS 请求使用校验后的固定 IP，正确解压 JSON 并保留本次站点 Cookie', async () => {
  let requestOptions: unknown
  const req = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() })
  vi.mocked(request).mockImplementation((...args: unknown[]) => {
    requestOptions = args[1]
    req.end.mockImplementation(() => {
      const response = Object.assign(new EventEmitter(), { statusCode: 200, headers: { 'content-type': 'application/json', 'content-encoding': 'gzip', 'set-cookie': ['csrf=TEST; Secure; HttpOnly'] } })
      ;(args[2] as (value: unknown) => void)(response)
      response.emit('data', gzipSync(Buffer.from('{"jobs":[]}'))); response.emit('end'); req.emit('close')
    })
    return req as unknown as ReturnType<typeof request>
  })
  const resolve = vi.fn(async () => ({ address: '93.184.216.34', family: 4 }))
  const result = await readBrowserResource('https://example.com/api/jobs', 'GET', { authorization: 'DO-NOT-FORWARD' }, null, Date.now() + 5000, resolve)
  expect(result.body.toString()).toBe('{"jobs":[]}')
  expect(result.headers['content-encoding']).toBeUndefined()
  expect(result.headers['set-cookie']).toContain('csrf=TEST')
  const options = requestOptions as { headers: Record<string, string>; lookup: (...args: unknown[]) => void }
  expect(options.headers.authorization).toBeUndefined()
  const callback = vi.fn(); options.lookup('example.com', {}, callback)
  expect(callback).toHaveBeenCalledWith(null, '93.184.216.34', 4)
})
it('DNS 判定为内网或超时，不会再向该地址发送浏览器代理请求', async () => {
  await expect(readBrowserResource('https://evil.test/jobs', 'GET', {}, null, Date.now() + 5000, async () => { throw new Error('内网地址') })).rejects.toThrow('内网')
  expect(request).not.toHaveBeenCalled()
})
