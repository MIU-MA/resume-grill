import { beforeEach, expect, it, vi } from 'vitest'
import { handlePracticeReview } from './practice-review-api'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
vi.mock('@/providers/openai-compatible', () => ({ llmStructured: vi.fn(), resolveLlmConfig: vi.fn() }))
vi.mock('@/lib/server-limits', () => ({ getClientIp: () => 'test', rateLimit: () => ({ ok: true }), withTimeout: () => new AbortController().signal, SUMMARIZE_TIMEOUT: 100000 }))
const request = (value: unknown) => new Request('http://localhost/api/practice-review', { method: 'POST', body: JSON.stringify(value) })
beforeEach(() => { vi.clearAllMocks(); vi.mocked(resolveLlmConfig).mockReturnValue({ baseUrl: 'https://example.com/v1', apiKey: 'test', model: 'test' }) })
it('只保留真实记录中逐字可查的复盘依据，分别保留知识和表达问题', async () => {
  const valid = { topic: '幂等', explanation: '补充实际处理', question: '如何处理重复请求？', evidence: '用唯一键', kind: 'knowledge' }
  vi.mocked(llmStructured).mockResolvedValue({ summary: '复盘', gaps: [valid, { ...valid, evidence: '并不存在的回答' }] })
  const response = await handlePracticeReview(request({ action: 'interview', text: '我会用唯一键处理重复请求', context: '支付研发' }))
  expect(await response.json()).toEqual({ summary: '复盘', gaps: [valid] })
  expect(vi.mocked(llmStructured).mock.calls[0][0]).not.toContain('支付研发')
})
it('空输入和超长输入不会调用模型；模型未配置明确报错', async () => {
  expect((await handlePracticeReview(request({ action: 'card', text: '' }))).status).toBe(400)
  expect((await handlePracticeReview(request({ action: 'card', text: 'x'.repeat(20001) }))).status).toBe(400)
  expect(llmStructured).not.toHaveBeenCalled()
  vi.mocked(resolveLlmConfig).mockReturnValue(null)
  expect((await handlePracticeReview(request({ action: 'card', text: '回答' }))).status).toBe(400)
})
it('闪卡检验按显式请求返回反馈，不改变复习或掌握状态', async () => {
  vi.mocked(llmStructured).mockResolvedValue({ score: 65, feedback: '需要补充异常场景' })
  const response = await handlePracticeReview(request({ action: 'card', text: '使用唯一键', context: '解释幂等' }))
  expect(await response.json()).toEqual({ score: 65, feedback: '需要补充异常场景' })
})
