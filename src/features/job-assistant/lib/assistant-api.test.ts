import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { careerSites } from '@/data/career-sites'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { rateLimit } from '@/lib/server-limits'
import { assistantSources, handleAssistantRequest } from './assistant-api'

vi.mock('@/providers/openai-compatible', () => ({ llmStructured: vi.fn(), resolveLlmConfig: vi.fn() }))
vi.mock('@/lib/server-limits', () => ({ MAX_RAWTEXT: 20000, getClientIp: () => 'test', rateLimit: vi.fn(() => ({ ok: true })), withTimeout: () => new AbortController().signal }))
const config = { baseUrl: 'https://model.example/v1', apiKey: 'secret-test-only', model: 'test' }
const plan = { keywords: ['前端'], cities: [], experience: '', excludedCompanies: [], sourceUrls: [careerSites[0].url] }
const request = (extra = {}) => new Request('http://localhost/api/job-assistant', { method: 'POST', body: JSON.stringify({ action: 'plan', goal: '前端工作', resume: 'React 项目', ...extra }) })
function modelReply(value: unknown) {
  vi.mocked(llmStructured).mockImplementation(async (_system, _user, schema) => (schema as z.ZodType).parse(value))
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(resolveLlmConfig).mockReturnValue(config); vi.mocked(rateLimit).mockReturnValue({ ok: true }) })

describe('求职助手接口', () => {
  it('仅规划收录官网或用户明确提供的 HTTPS 链接，不接受模型补造来源', async () => {
    modelReply({ ...plan, sourceUrls: ['https://invented.example/careers'] })
    expect((await handleAssistantRequest(request())).status).toBe(502)
    const supplied = 'https://company.example/jobs'
    modelReply({ ...plan, sourceUrls: [supplied] })
    const response = await handleAssistantRequest(request({ goal: `前端工作 ${supplied}` }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ sources: [{ company: 'company.example', url: supplied }] })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(assistantSources('http://bad.example https://name:password@bad.example https://bad.example:8080').every(source => !source.url.includes('bad.example'))).toBe(true)
  })
  it('排除公司后返回真实查找范围，任务响应不携带模型凭据', async () => {
    modelReply({ ...plan, sourceUrls: [careerSites[0].url, careerSites[1].url], excludedCompanies: [careerSites[0].company] })
    const response = await handleAssistantRequest(request({ llm: config }))
    const data = await response.json()
    expect(data.sources).toEqual([{ company: careerSites[1].company, url: careerSites[1].url }])
    expect(JSON.stringify(data)).not.toContain(config.apiKey)
    expect(vi.mocked(resolveLlmConfig)).toHaveBeenCalledWith(config)
  })
  it('原文核对失败时不返回未经验证的判断或服务商错误内容', async () => {
    modelReply({ results: [{ id: 'one', verdict: 'match', summary: '适合', checks: [{ requirement: 'React', status: 'supported', jobQuote: 'React', resumeQuote: '编造的经历' }] }] })
    const response = await handleAssistantRequest(request({ action: 'match', plan, jobs: [{ id: 'one', company: '', role: '前端', url: plan.sourceUrls[0], description: 'React' }] }))
    expect(response.status).toBe(502)
    vi.mocked(llmStructured).mockRejectedValueOnce(new Error(config.apiKey))
    expect(await (await handleAssistantRequest(request())).text()).not.toContain(config.apiKey)
  })
  it('支持匹配结果并拒绝超过一批的岗位', async () => {
    const job = { id: 'one', company: '', role: '前端', url: plan.sourceUrls[0], description: 'React' }
    modelReply({ results: [{ id: 'one', verdict: 'match', summary: '有 React 项目经历', checks: [{ requirement: 'React', status: 'supported', jobQuote: 'React', resumeQuote: 'React 项目' }] }] })
    const response = await handleAssistantRequest(request({ action: 'match', plan, jobs: [job] }))
    expect((await response.json()).results[0].verdict).toBe('match')
    expect((await handleAssistantRequest(request({ action: 'match', plan, jobs: Array(6).fill(job) }))).status).toBe(400)
    expect(llmStructured).toHaveBeenCalledTimes(1)
  })
  it('没有模型配置、错误输入、超大请求均不调用模型', async () => {
    vi.mocked(resolveLlmConfig).mockReturnValue(null)
    expect((await handleAssistantRequest(request())).status).toBe(400)
    expect((await handleAssistantRequest(request({ resume: '' }))).status).toBe(400)
    expect((await handleAssistantRequest(request({ resume: 'a'.repeat(350001) }))).status).toBe(413)
    expect(llmStructured).not.toHaveBeenCalled()
  })
  it('限流时提供重试时间且不执行模型', async () => {
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 60 })
    const response = await handleAssistantRequest(request())
    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('60')
    expect(llmStructured).not.toHaveBeenCalled()
  })
})
