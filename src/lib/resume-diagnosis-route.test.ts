import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../../app/api/diagnose/route'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { rateLimit } from '@/lib/server-limits'
import { buildDemoDiagnosis } from './resume-diagnosis'
import type { ZodType } from 'zod'

vi.mock('@/providers/openai-compatible', () => ({ llmStructured: vi.fn(), resolveLlmConfig: vi.fn() }))
vi.mock('@/lib/server-limits', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/server-limits')>(),
  rateLimit: vi.fn(),
}))

const resume = '张三\n项目经历\n- 优化接口响应，从 800ms 降至 120ms\n技能\n- 前端：React'
const config = { baseUrl: 'https://provider.example/v1', apiKey: 'test-key', model: 'test-model' }
const request = (body: unknown, signal?: AbortSignal) => new Request('http://localhost/api/diagnose', { method: 'POST', body: JSON.stringify(body), signal })

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(rateLimit).mockReturnValue({ ok: true })
  vi.mocked(resolveLlmConfig).mockReturnValue(config)
  vi.mocked(llmStructured).mockImplementation(async (_system: string, _user: string, schema: ZodType) => schema.parse(buildDemoDiagnosis(resume)))
})

describe('POST /api/diagnose', () => {
  it('uses the supplied configuration and returns a non-cacheable report', async () => {
    const response = await POST(request({ rawText: resume, llm: config }))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(resolveLlmConfig).toHaveBeenCalledWith(config)
    const data = await response.json()
    expect(data.source).toBe('model')
    expect(data.issues[0].priority).toBe('high')
  })

  it('keeps the demo free even if model credentials are configured', async () => {
    const response = await POST(request({ rawText: resume, demo: true }))
    expect((await response.json()).source).toBe('demo')
    expect(llmStructured).not.toHaveBeenCalled()
    expect(resolveLlmConfig).not.toHaveBeenCalled()
  })

  it('asks for configuration instead of pretending to diagnose a real resume', async () => {
    vi.mocked(resolveLlmConfig).mockReturnValue(null)
    const response = await POST(request({ rawText: resume }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('配置模型')
    expect(llmStructured).not.toHaveBeenCalled()
  })

  it('rejects empty text, excessively long history and partial configuration', async () => {
    for (const body of [{ rawText: ' ' }, { rawText: 'a'.repeat(20_001) }, { rawText: resume, jobDescription: 'a'.repeat(12_001) }, { rawText: resume, llm: { apiKey: 'test' } }]) {
      expect((await POST(request(body))).status).toBe(400)
    }
    expect(llmStructured).not.toHaveBeenCalled()
  })

  it('limits actual body bytes without trusting a content-length header', async () => {
    const response = await POST(request({ rawText: '中'.repeat(100_000) }))
    expect(response.status).toBe(413)
    expect(llmStructured).not.toHaveBeenCalled()
  })

  it('rejects fabricated quotations even when the output has valid JSON fields', async () => {
    vi.mocked(llmStructured).mockImplementation(async (_system: string, _user: string, schema: ZodType) => {
      const report = buildDemoDiagnosis(resume)
      return schema.parse({ ...report, strengths: [{ ...report.strengths[0], evidence: '编造的原句' }] })
    })
    const response = await POST(request({ rawText: resume }))
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('编造的原句')
  })

  it('does not expose upstream errors or credentials to the browser', async () => {
    vi.mocked(llmStructured).mockRejectedValue(new Error('private upstream body: test-key'))
    const response = await POST(request({ rawText: resume }))
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('test-key')
  })

  it('propagates client cancellation to the model request', async () => {
    const abort = new AbortController()
    vi.mocked(llmStructured).mockImplementation(async (_system, _user, _schema, _config, options) => {
      abort.abort()
      expect(options?.signal?.aborted).toBe(true)
      throw new Error('cancelled')
    })
    const response = await POST(request({ rawText: resume }, abort.signal))
    expect(response.status).toBe(504)
  })

  it('shares the model request rate limit and provides a retry delay', async () => {
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 30 })
    const response = await POST(request({ rawText: resume }))
    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('30')
    expect(llmStructured).not.toHaveBeenCalled()
  })
})
