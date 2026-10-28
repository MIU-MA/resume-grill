import { beforeEach, expect, it, vi } from 'vitest'
import { POST } from '../../../../app/api/tailor-resume/route'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { rateLimit } from '@/lib/server-limits'
import { tailoringSections } from '@/domain/resume-tailoring'
import { buildTailoringPrompt } from './resume-tailoring-prompt'
vi.mock('@/providers/openai-compatible', () => ({ llmStructured: vi.fn(), resolveLlmConfig: vi.fn() }))
vi.mock('@/lib/server-limits', async original => ({ ...await original<typeof import('@/lib/server-limits')>(), rateLimit: vi.fn() }))
const rawText = '林同学\n项目经历\n- 使用 React 开发页面'
const jobDescription = '前端工程师，使用 React 开发页面'
const config = { baseUrl: 'https://provider.example/v1', apiKey: 'test-secret', model: 'test-model' }
const request = (body: unknown) => new Request('http://localhost/api/tailor-resume', { method: 'POST', body: JSON.stringify(body) })
it('提示词对每条原文标明模型能否改写，技术简介不会随身份字段一起锁定', () => {
  const raw = '林同学\n电话：13800000000\n邮箱：lin@example.com\n2028 届本科生，具备 React 项目实践，参与开发前端页面。'
  const prompt = JSON.parse(buildTailoringPrompt(raw, '前端开发'))
  expect(prompt.resumeSections[0].lines.map((line: { editable: boolean }) => line.editable)).toEqual([false, false, false, true])
})
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(rateLimit).mockReturnValue({ ok: true }); vi.mocked(resolveLlmConfig).mockReturnValue(config)
  vi.mocked(llmStructured).mockImplementation(async (_s, _u, schema) => schema.parse({ company: '', role: '前端工程师', sectionOrder: tailoringSections(rawText).map(section => section.id), changes: [], highlights: [], gaps: [] }))
})
it('使用用户模型配置并校验返回值，结果不缓存', async () => {
  const response = await POST(request({ rawText, jobDescription, llm: config }))
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store')
  expect(resolveLlmConfig).toHaveBeenCalledWith(config)
  expect((await response.json()).role).toBe('前端工程师')
})
it('缺少 JD、配置不完整或请求过大时不调用模型', async () => {
  for (const body of [{ jobDescription }, { rawText: '', jobDescription }, { rawText }, { rawText, jobDescription: '' }, { rawText, jobDescription, llm: {} }, { rawText: '中'.repeat(100000), jobDescription }]) expect((await POST(request(body))).status).toBeGreaterThanOrEqual(400)
  expect(llmStructured).not.toHaveBeenCalled()
  vi.mocked(resolveLlmConfig).mockReturnValue(null)
  expect((await POST(request({ rawText, jobDescription }))).status).toBe(400)
})
it('共享限流并隐藏上游错误和密钥', async () => {
  vi.mocked(llmStructured).mockRejectedValue(new Error('test-secret upstream response'))
  const response = await POST(request({ rawText, jobDescription }))
  expect(response.status).toBe(502); expect(await response.text()).not.toContain('test-secret')
  vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 30 })
  expect((await POST(request({ rawText, jobDescription }))).status).toBe(429)
})
it('一条受保护的信息被改写时返回其余建议，不因整章锁定报 502', async () => {
  const source = '林同学\n项目经历\n- 使用 React 开发页面'
  vi.mocked(llmStructured).mockImplementation(async (_s, _u, schema) => schema.parse({
    company: '', role: '前端工程师', sectionOrder: ['section-0', 'section-1'],
    changes: [
      { sectionId: 'section-0', lineIndex: 0, after: '另一个名字', requirement: '前端工程师', reason: '不应改姓名' },
      { sectionId: 'section-1', lineIndex: 0, after: '- 使用 React 开发页面。', requirement: '使用 React 开发页面', reason: '补全句子' },
    ], highlights: [], gaps: [],
  }))
  const response = await POST(request({ rawText: source, jobDescription, llm: config }))
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body.changes).toHaveLength(1)
  expect(body.changes[0].sectionId).toBe('section-1')
  expect(body.notices).toHaveLength(1)
  expect(llmStructured).toHaveBeenCalledOnce()
})
