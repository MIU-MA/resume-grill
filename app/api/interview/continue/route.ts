import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resumeClaimSchema } from '@/domain/resume-schema'
import { interviewRoundSchema, interviewContinueSchema } from '@/domain/interview-schema'
import { INTERVIEW_CONTINUE_SYSTEM, buildInterviewContinueUser } from '@/lib/interview-prompts'
import { sanitizeCoverage } from '@/lib/coverage'
import { INTERVIEW_TIMEOUT, MAX_ANSWER, MAX_TURNS, getClientIp, rateLimit, withTimeout } from '@/lib/server-limits'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { mergeCoveredPoints, shouldFinishInterview } from '@/lib/interview-state'

const requestSchema = z.object({
  claim: resumeClaimSchema,
  question: z.string(),
  answer: z.string().trim().max(MAX_ANSWER),
  annotation: z.string().trim().max(500).default(''),
  rounds: z.array(interviewRoundSchema).max(MAX_TURNS).default([]),
  verifyPoints: z.array(z.object({ point: z.string(), importance: z.enum(['high', 'medium', 'low']) })),
  trapPoints: z.array(z.string()),
  llm: z.object({
    baseUrl: z.string().optional(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
  }).optional(),
}).refine((body) => body.answer.length > 0 || body.annotation.length > 0, {
  message: '回答和不懂批注不能同时为空',
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
        body.claim,
        body.question,
        body.answer,
        body.annotation,
        body.rounds,
        body.verifyPoints,
        body.trapPoints,
      ),
      interviewContinueSchema,
      config,
      { signal: withTimeout(INTERVIEW_TIMEOUT), maxTokens: 800 },
    )
    const hasAnswer = body.answer.length > 0
    const currentCoverage = sanitizeCoverage(
      hasAnswer ? result.evaluation.coveredPoints : [],
      body.claim.evaluationPoints,
    )
    const coveredPoints = mergeCoveredPoints(body.rounds, currentCoverage.covered, body.claim.evaluationPoints)
    const importantPoints = body.verifyPoints
      .filter((point) => point.importance === 'high')
      .map((point) => point.point)
      .filter((point) => body.claim.evaluationPoints.includes(point))
    const roundNumber = body.rounds.filter((round) => round.answer.trim().length > 0).length + (hasAnswer ? 1 : 0)
    const isFinal = hasAnswer && shouldFinishInterview(roundNumber, result.isFinal, coveredPoints, importantPoints)
    return NextResponse.json({
      ...result,
      isFinal,
      nextQuestion: isFinal ? '' : (result.nextQuestion || '请再补充一个具体的过程、决策或结果。'),
      evaluation: {
        ...result.evaluation,
        score: hasAnswer ? result.evaluation.score : 0,
        coveredPoints,
        missingPoints: body.claim.evaluationPoints.filter((point) => !coveredPoints.includes(point)),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成下一问失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
