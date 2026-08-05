import { NextResponse } from 'next/server'
import { z } from 'zod'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { getClientIp, rateLimit, withTimeout } from '@/lib/server-limits'

const TEST_CONNECTION_TIMEOUT = 15_000

const requestSchema = z.object({
  llm: z.object({
    baseUrl: z.string().min(1),
    apiKey: z.string().min(1),
    model: z.string().min(1),
  }).optional(),
})

const echoSchema = z.object({ ok: z.boolean() })

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const limit = rateLimit(ip)
  if (!limit.ok) {
    return NextResponse.json({ error: `请求过于频繁，请 ${limit.retryAfter} 秒后再试` }, { status: 429 })
  }

  let body: z.infer<typeof requestSchema>
  try {
    body = requestSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: '请求参数不合法' }, { status: 400 })
  }

  try {
    const config = resolveLlmConfig(body.llm ?? null)
    if (!config) {
      return NextResponse.json({ error: '请填写 Base URL / API Key / Model' }, { status: 400 })
    }

    await llmStructured(
      '你是一个测试助手。输出 {"ok": true}',
      '请回复 ok',
      echoSchema,
      config,
      { signal: withTimeout(TEST_CONNECTION_TIMEOUT), maxTokens: 50 },
    )

    return NextResponse.json({ success: true, model: config.model })
  } catch (error) {
    const message = error instanceof Error ? error.message : '连接测试失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
