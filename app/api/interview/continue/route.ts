import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resumeClaimSchema } from '@/domain/resume-schema'
import { interviewRoundSchema, interviewContinueSchema } from '@/domain/interview-schema'
import { INTERVIEW_CONTINUE_SYSTEM, buildInterviewContinueUser } from '@/lib/interview-prompts'
import { INTERVIEW_TIMEOUT, getClientIp, rateLimit, withTimeout } from '@/lib/server-limits'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'

const requestSchema = z.object({
  claim: resumeClaimSchema,
  question: z.string(),
  answer: z.string(),
  rounds: z.array(interviewRoundSchema).default([]),
  verifyPoints: z.array(z.object({ point: z.string(), importance: z.enum(['high', 'medium', 'low']) })),
  trapPoints: z.array(z.string()),
  llm: z.object({
    baseUrl: z.string().optional(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
  }).optional(),
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
    if (!config) {
      return NextResponse.json({ error: '请配置 API Key' }, { status: 400 })
    }
    const result = await llmStructured(
      INTERVIEW_CONTINUE_SYSTEM,
      buildInterviewContinueUser(
        body.claim.content,
        body.question,
        body.answer,
        body.rounds,
        body.verifyPoints,
        body.trapPoints,
      ),
      interviewContinueSchema,
      config,
      { signal: withTimeout(INTERVIEW_TIMEOUT), maxTokens: 800 },
    )
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成下一问失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
