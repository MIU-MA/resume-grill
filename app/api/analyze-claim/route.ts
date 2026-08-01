import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resumeClaimSchema } from '@/domain/resume-schema'
import { claimAnalysisSchema } from '@/domain/interview-schema'
import { ANALYZE_CLAIM_SYSTEM, buildAnalyzeClaimUser } from '@/lib/interview-prompts'
import { ANALYZE_TIMEOUT, getClientIp, rateLimit, withTimeout } from '@/lib/server-limits'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { canonicalizeVerifyPoints } from '@/lib/interview-state'

const requestSchema = z.object({
  claim: resumeClaimSchema,
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
    const analysis = await llmStructured(
      ANALYZE_CLAIM_SYSTEM,
      buildAnalyzeClaimUser(body.claim),
      claimAnalysisSchema,
      config,
      { signal: withTimeout(ANALYZE_TIMEOUT), maxTokens: 600 },
    )
    return NextResponse.json({
      ...analysis,
      verifyPoints: canonicalizeVerifyPoints(body.claim.evaluationPoints, analysis.verifyPoints),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '声明分析失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
