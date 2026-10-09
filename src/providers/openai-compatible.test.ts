import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { llmStructured, parseModelJson } from './openai-compatible'

vi.mock('@/lib/url-guard', () => ({ assertAllowedBaseUrl: vi.fn().mockResolvedValue(undefined) }))

afterEach(() => { vi.unstubAllGlobals() })

describe('model output limits', () => {
  const config = { baseUrl: 'https://provider.example/v1', apiKey: 'test-key', model: 'test-model' }
  it('leaves output length to the provider and forwards the complete input', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content: '{"summary":"完整结果"}' } }],
    })))
    vi.stubGlobal('fetch', fetchMock)
    const input = '详细经历'.repeat(1500) + '\n最后一段：负责接口重试。'
    const result = await llmStructured('检查简历', input, z.object({ summary: z.string() }), config)
    const [, request] = fetchMock.mock.calls[0]
    const body = JSON.parse(request.body)
    expect(body.messages[1].content).toBe(input)
    expect(body).not.toHaveProperty('max_tokens')
    expect(body).not.toHaveProperty('max_completion_tokens')
    expect(body).not.toHaveProperty('max_output_tokens')
    expect(result.summary).toBe('完整结果')
  })

  it('still rejects results truncated by the upstream model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: 'length', message: { content: '{"summary":"半截' } }],
    }))))
    await expect(llmStructured('检查简历', '正文', z.object({ summary: z.string() }), config)).rejects.toThrow('截断')
  })
})

describe('parseModelJson', () => {
  it('parses a plain JSON response', () => {
    expect(parseModelJson('{"candidate":"张三","claims":[]}')).toEqual({ candidate: '张三', claims: [] })
  })

  it('parses JSON wrapped in a markdown code block', () => {
    expect(parseModelJson('```json\n{"candidate":"张三"}\n```')).toEqual({ candidate: '张三' })
  })

  it('extracts a balanced JSON object from model prose', () => {
    expect(parseModelJson('分析完成，结果如下：\n{"summary":"包含 { 字符也不会中断"}\n以上。')).toEqual({
      summary: '包含 { 字符也不会中断',
    })
  })

  it('repairs truncated JSON by closing unmatched brackets', () => {
    expect(parseModelJson('{"candidate":"张三","claims":[')).toEqual({
      candidate: '张三',
      claims: [],
    })
  })

  it('rejects JSON truncated mid-string', () => {
    expect(() => parseModelJson('{"candidate":"张')).toThrow()
  })
})
