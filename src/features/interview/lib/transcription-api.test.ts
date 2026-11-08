import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { handleTranscribe } from './transcription-api'
import { assertAllowedBaseUrl } from '@/lib/url-guard'
vi.mock('@/providers/openai-compatible', () => ({ resolveLlmConfig: () => ({ baseUrl: 'https://example.com/v1', apiKey: 'test-only', model: 'chat-model' }) }))
vi.mock('@/lib/url-guard', () => ({ assertAllowedBaseUrl: vi.fn(async () => undefined) }))
vi.mock('@/lib/server-limits', () => ({ getClientIp: () => 'test', rateLimit: () => ({ ok: true }), withTimeout: () => new AbortController().signal }))
const fetchMock = vi.fn()
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock) })
afterEach(() => vi.unstubAllGlobals())
const request = (name = 'interview.wav') => { const form = new FormData(); form.set('audio', new File(['demo audio'], name)); form.set('model', 'custom-asr'); return new Request('http://localhost/api/transcribe', { method: 'POST', body: form }) }
it('使用独立的转写模型并校验地址，不发送聊天模型或简历正文', async () => {
  fetchMock.mockResolvedValue(Response.json({ text: '面试转写内容' }))
  const response = await handleTranscribe(request())
  expect(await response.json()).toEqual({ text: '面试转写内容' })
  expect(assertAllowedBaseUrl).toHaveBeenCalledWith('https://example.com/v1')
  expect(fetchMock.mock.calls[0][0]).toBe('https://example.com/v1/audio/transcriptions')
  expect(fetchMock.mock.calls[0][1].body.get('model')).toBe('custom-asr')
  expect(fetchMock.mock.calls[0][1].redirect).toBe('error')
})
it('不支持的文件不会调用服务，服务失败不透出密钥或上游响应正文', async () => {
  expect((await handleTranscribe(request('notes.txt'))).status).toBe(400)
  expect(fetchMock).not.toHaveBeenCalled()
  fetchMock.mockResolvedValue(new Response('private-service-detail', { status: 401 }))
  const response = await handleTranscribe(request())
  expect(response.status).toBe(502)
  expect(JSON.stringify(await response.json())).not.toContain('private-service-detail')
})
