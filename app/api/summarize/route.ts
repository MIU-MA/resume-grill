import { NextResponse } from 'next/server'
import { z } from 'zod'
import { interviewTurnSchema, sessionSummarySchema } from '@/domain/interview-schema'
import { resumeClaimSchema } from '@/domain/resume-schema'
import { buildSummarizeUserPrompt, SUMMARIZE_SYSTEM_PROMPT } from '@/lib/prompts'
import { SUMMARIZE_TIMEOUT, getClientIp, rateLimit, withTimeout } from '@/lib/server-limits'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { mockSummarize } from '@/providers/mock'

const requestSchema = z.object({
  claim: resumeClaimSchema,
  turns: z.array(interviewTurnSchema).default([]),
  covered: z.array(z.string()).default([]),
  missing: z.array(z.string()).default([]),
  llm: z
    .object({
      baseUrl: z.string().optional(),
      apiKey: z.string().optional(),
      model: z.string().optional(),
    })
    .optional(),
})

export async function POST(request: Request) {
  const ip = getClientIp(request)
  const limit = rateLimit(ip)
  if (!limit.ok) {
    return NextResponse.json({ error: `请求过于频繁，请 ${limit.retryAfter} 秒后再试` }, { status: 429 })
  }

  let body: z.infer<typeof requestSchema>
  try {
    body = requestSchema.parse(await request.json())
  } catch (error) {
    const message = error instanceof Error ? error.message : '请求参数不合法'
    return NextResponse.json({ error: message }, { status: 400 })
  }

  try {
    const config = resolveLlmConfig(body.llm ?? null)
    if (config) {
      const summary = await llmStructured(
        SUMMARIZE_SYSTEM_PROMPT,
        buildSummarizeUserPrompt(body.claim, body.turns, body.covered, body.missing),
        sessionSummarySchema,
        config,
        { signal: withTimeout(SUMMARIZE_TIMEOUT), maxTokens: 800 },
      )
      return NextResponse.json(summary)
    }

    return NextResponse.json(mockSummarize(body.claim, body.turns, body.covered, body.missing))
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成总结失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
