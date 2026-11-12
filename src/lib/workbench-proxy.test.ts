import { afterEach, expect, it, vi } from 'vitest'
import { proxyResumeSnapshot } from './workbench-proxy'

const token = 'a-test-secret-at-least-thirty-two-characters'
const snapshot = { sourceName: '简历.pdf', rawText: '姓名\n项目内容' }
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
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
