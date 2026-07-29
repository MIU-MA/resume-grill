import { NextResponse } from 'next/server'
import { z } from 'zod'
import { interviewTurnSchema, nextQuestionSchema } from '@/domain/interview-schema'
import { resumeClaimSchema } from '@/domain/resume-schema'
import { sanitizeCoverage } from '@/lib/coverage'
import { INTERVIEW_SYSTEM_PROMPT, buildInterviewUserPrompt } from '@/lib/prompts'
import { INTERVIEW_TIMEOUT, MAX_ANSWER, MAX_TURNS, getClientIp, rateLimit, withTimeout } from '@/lib/server-limits'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { mockNextQuestion } from '@/providers/mock'

const requestSchema = z.object({
  claim: resumeClaimSchema,
  turns: z.array(interviewTurnSchema.extend({ answer: z.string().max(MAX_ANSWER, '单轮回答过长') })).max(MAX_TURNS, `追问轮数超过上限 ${MAX_TURNS}`).default([]),
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
      const next = await llmStructured(
        INTERVIEW_SYSTEM_PROMPT,
        buildInterviewUserPrompt(body.claim, body.turns),
        nextQuestionSchema,
        config,
        { signal: withTimeout(INTERVIEW_TIMEOUT), maxTokens: 800 },
      )
      // 覆盖要点交集校验：只保留 evaluationPoints 子集，丢弃模型伪造项。
      const { covered, missing } = sanitizeCoverage(next.coveredPoints, body.claim.evaluationPoints)
      return NextResponse.json({ ...next, coveredPoints: covered, missingPoints: missing })
    }

    return NextResponse.json(mockNextQuestion(body.claim, body.turns))
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成下一问失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
