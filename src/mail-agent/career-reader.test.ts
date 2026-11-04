import { expect, it, vi } from 'vitest'
import { discoverRecruitingPage } from './career-reader'
import type { CareerDiscovery } from '../domain/mail-schema'
const empty: CareerDiscovery = { links: [], pagesRead: 1, notes: [] }
const loaded: CareerDiscovery = { ...empty, listingRead: true, pages: [{ url: 'https://example.com/jobs/1', title: '后端', role: '后端', company: '示例', emails: [], recommendedEmail: '', notes: [], jobDescription: '维护服务' }] }
it('首页读到无关岗位时仍按全栈及同义名称搜索，失败也保留原岗位', async () => {
  const fullstack = { ...loaded, pages: [{ ...loaded.pages![0], role: 'Full-stack Engineer' }] }
  const tools = { static: vi.fn().mockResolvedValue(loaded), browser: vi.fn().mockResolvedValue(fullstack), tencent: vi.fn() }
  const result = await discoverRecruitingPage('https://example.com/jobs', ['全栈'], tools)
  expect(tools.browser).toHaveBeenCalledWith('https://example.com/jobs', ['全栈', '全端', 'Full Stack'])
  expect(result.pages?.map(page => page.role)).toContain('Full-stack Engineer')
  tools.browser.mockRejectedValueOnce(new Error('timeout'))
  expect((await discoverRecruitingPage('https://example.com/jobs', ['全栈'], tools)).pages).toEqual(loaded.pages)
  tools.browser.mockResolvedValueOnce(empty)
  expect((await discoverRecruitingPage('https://example.com/jobs', ['律师'], tools)).pages).toEqual(loaded.pages)
})
it('静态网页只有外壳或请求失败时，自动进入浏览器读取并传递目标关键词', async () => {
  const tools = { static: vi.fn().mockResolvedValue(empty), browser: vi.fn().mockResolvedValue(loaded), tencent: vi.fn() }
  expect(await discoverRecruitingPage('https://example.com/jobs', ['后端'], tools)).toEqual(loaded)
  expect(tools.browser).toHaveBeenCalledWith('https://example.com/jobs', expect.arrayContaining(['后端']))
  tools.static.mockRejectedValueOnce(new Error('not html'))
  expect(await discoverRecruitingPage('https://example.com/jobs', ['会计'], tools)).toBe(loaded)
})
it('动态官网原网页有岗位时保留静态读取，不强制启动浏览器', async () => {
  const tools = { static: vi.fn().mockResolvedValue(loaded), browser: vi.fn().mockResolvedValue(loaded), tencent: vi.fn() }
  await discoverRecruitingPage('https://jobs.bytedance.com/', ['后端'], tools)
  expect(tools.static).toHaveBeenCalledOnce()
  await discoverRecruitingPage('https://example.com/jobs', [], tools)
  expect(tools.browser).not.toHaveBeenCalled()
})
it('动态读取失败不能丢掉原页面已经发现的入口链接', async () => {
  const initial = { ...empty, links: [{ url: 'https://example.com/careers', sourceUrl: 'https://example.com/', label: '招聘', kind: 'entry' as const }] }
  const tools = { static: vi.fn().mockResolvedValue(initial), browser: vi.fn().mockRejectedValue(new Error('browser missing')), tencent: vi.fn() }
  const result = await discoverRecruitingPage('https://example.com/', [], tools)
  expect(result.links).toEqual(initial.links)
  expect(result.notes.join('')).toContain('已保留原网页')
})

it('动态读取和静态读取的不同岗位同时保留，重复岗位用动态正文更新', async () => {
  const updated = { ...loaded.pages![0], jobDescription: '完整职责和任职要求' }
  const extra = { ...updated, url: 'https://example.com/jobs/2', role: '财务' }
  const tools = { static: vi.fn().mockResolvedValue(loaded), browser: vi.fn().mockResolvedValue({ ...empty, pages: [updated, extra] }), tencent: vi.fn() }
  const result = await discoverRecruitingPage('https://example.com/jobs', ['财务'], tools)
  expect(result.pages).toEqual([updated, extra])
})
