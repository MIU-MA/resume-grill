import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import { afterEach, expect, it, vi } from 'vitest'
import { readCareerPage, resolvePublicHost } from './public-page'
vi.mock('node:dns/promises', () => ({ lookup: vi.fn() }))
vi.mock('node:https', () => ({ request: vi.fn() }))
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })
it('DNS 受剩余预算限制，超时后不再发 HTTP 请求', async () => {
  vi.useFakeTimers(); vi.mocked(lookup).mockImplementation(() => new Promise(() => {}))
  const result = readCareerPage('https://example.com/jobs', 0, Date.now() + 1000)
  const assertion = expect(result).rejects.toThrow('解析超时')
  await vi.advanceTimersByTimeAsync(1000); await assertion
  expect(request).not.toHaveBeenCalled()
  expect(vi.getTimerCount()).toBe(0)
})
it('已经超过抓取预算时不再做 DNS 查询', async () => {
  await expect(resolvePublicHost('example.com', Date.now() - 1)).rejects.toThrow('超时')
  expect(lookup).not.toHaveBeenCalled()
})
