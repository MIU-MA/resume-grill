import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveLlmConfig } from '@/providers/openai-compatible'
import { assertAllowedBaseUrl } from '@/lib/url-guard'
import { getClientIp, rateLimit, withTimeout } from '@/lib/server-limits'
export async function handleTranscribe(request: Request) {
  if (!rateLimit(getClientIp(request)).ok) return NextResponse.json({ error: '请求过于频繁。' }, { status: 429 })
  try {
    const data = await request.formData(), audio = data.get('audio')
    if (!(audio instanceof File) || !audio.size || audio.size > 24 * 1024 * 1024 || !/\.(mp3|mp4|m4a|wav|webm|ogg)$/i.test(audio.name)) return NextResponse.json({ error: '请选择 24 MB 以内的 MP3、M4A、WAV、WebM 或 OGG 录音。' }, { status: 400 })
    const settings = z.object({ baseUrl: z.string(), apiKey: z.string(), model: z.string() }).optional().parse(JSON.parse(String(data.get('llm') ?? 'null')) ?? undefined)
    const config = resolveLlmConfig(settings)
    if (!config) return NextResponse.json({ error: '请先配置模型服务。' }, { status: 400 })
    await assertAllowedBaseUrl(config.baseUrl)
    const model = z.string().trim().min(1).max(120).parse(data.get('model'))
    const form = new FormData(); form.set('file', audio); form.set('model', model); form.set('response_format', 'json')
    const response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}` }, body: form, signal: withTimeout(100000), redirect: 'error' })
    if (!response.ok) return NextResponse.json({ error: `转写服务返回 ${response.status}。请确认该服务支持音频转写及填写的模型。` }, { status: 502 })
    const result = z.object({ text: z.string().max(20000) }).parse(await response.json())
    return NextResponse.json(result)
  } catch { return NextResponse.json({ error: '录音转写失败，请检查服务、模型或改为粘贴文字。' }, { status: 502 }) }
}
