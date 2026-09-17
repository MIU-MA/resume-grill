import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../../app/api/analyze/route'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { rateLimit } from '@/lib/server-limits'

vi.mock('@/providers/openai-compatible', () => ({ llmStructured: vi.fn(), resolveLlmConfig: vi.fn() }))
vi.mock('@/lib/server-limits', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/server-limits')>(),
  rateLimit: vi.fn(),
}))

const config = { baseUrl: 'https://provider.example/v1', apiKey: 'test-key', model: 'test-model' }
const rawText = '示例姓名\n项目经历\n- 优化接口响应，从 800ms 降至 120ms'
const request = (extra: Record<string, unknown>) => new Request('http://localhost/api/analyze', {
  method: 'POST',
  body: JSON.stringify({ rawText, sourceFile: 'sample.txt', ...extra }),
})

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(rateLimit).mockReturnValue({ ok: true })
  vi.mocked(resolveLlmConfig).mockReturnValue(config)
})

describe('resume practice demo', () => {
  it.each([{}, { llm: config }])('does not call a paid model for an explicit demo', async (extra) => {
    const response = await POST(request({ ...extra, demo: true }))
    expect(response.status).toBe(200)
    const analysis = await response.json()
    expect(analysis.claims.length).toBeGreaterThan(0)
    expect(analysis.rawText).toBe(rawText)
    expect(llmStructured).not.toHaveBeenCalled()
    expect(resolveLlmConfig).not.toHaveBeenCalled()
  })

  it('still requires model configuration for a real resume', async () => {
    vi.mocked(resolveLlmConfig).mockReturnValue(null)
    const response = await POST(request({ demo: false }))
    expect(response.status).toBe(400)
    expect(llmStructured).not.toHaveBeenCalled()
  })
})
