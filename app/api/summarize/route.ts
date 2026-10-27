import { NextResponse } from 'next/server'
import { z } from 'zod'
import { interviewRoundSchema, finalResultSchema } from '@/domain/interview-schema'
import { resumeClaimSchema } from '@/domain/resume-schema'
import { SUMMARIZE_TIMEOUT, getClientIp, rateLimit, withTimeout } from '@/lib/server-limits'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { SUMMARIZE_SYSTEM, buildSummarizeUser } from '@/features/interview/lib/summary-prompts'
import { interviewContextSchema } from '@/domain/interview-context'



const requestSchema = z.object({
  claim: resumeClaimSchema,
  context: interviewContextSchema.optional(),
  rounds: z.array(interviewRoundSchema).default([]),
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
      SUMMARIZE_SYSTEM,
      buildSummarizeUser(body.claim, body.rounds, body.context),
      finalResultSchema,
      config,
      { signal: withTimeout(SUMMARIZE_TIMEOUT) },
    )

    return NextResponse.json({
      ...result,
      masteryLevel: masteryLevelFromScore(result.masteryScore),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成总结失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function masteryLevelFromScore(score: number): 'mastered' | 'partial' | 'not_demonstrated' {
  if (score >= 4) return 'mastered'
  if (score >= 2) return 'partial'
  return 'not_demonstrated'
}
