import { NextResponse } from 'next/server'
import { z } from 'zod'
import { resumeClaimSchema } from '@/domain/resume-schema'
import { interviewActionSchema, interviewRoundSchema, interviewContinueSchema } from '@/domain/interview-schema'
import { INTERVIEW_CONTINUE_SYSTEM, buildInterviewContinueUser } from '@/lib/interview-prompts'
import { sanitizeCoverage } from '@/lib/coverage'
import { INTERVIEW_TIMEOUT, MAX_ANSWER, MAX_TURNS, getClientIp, rateLimit, withTimeout } from '@/lib/server-limits'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { MAX_INTERVIEW_ROUNDS, mergeCoveredPoints, shouldFinishInterview } from '@/lib/interview-state'

const requestSchema = z.object({
  claim: resumeClaimSchema,
  action: interviewActionSchema.default('answer'),
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
}).refine((body) => (
  (body.action === 'answer' && body.answer.length > 0)
  || (body.action === 'clarify' && body.annotation.length > 0)
  || (body.action === 'skip' && body.answer.length === 0 && body.annotation.length === 0)
), {
  message: '提交内容与操作类型不匹配',
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
        body.action,
        body.rounds,
        body.verifyPoints,
        body.trapPoints,
      ),
      interviewContinueSchema,
      config,
      { signal: withTimeout(INTERVIEW_TIMEOUT), maxTokens: 2000 },
    )

    const hasAnswer = body.action === 'answer' && body.answer.length > 0
    const isSkip = body.action === 'skip'

    const allMasteryPoints = body.claim.masteryPoints.map((mp) => mp.point)

    const currentCoverage = sanitizeCoverage(
      hasAnswer ? result.evaluation.coveredPoints : [],
      allMasteryPoints,
    )
    const coveredPoints = mergeCoveredPoints(body.rounds, currentCoverage.covered, allMasteryPoints)
    const missingPoints = allMasteryPoints.filter((point) => !coveredPoints.includes(point))

    const importantPoints = body.verifyPoints
      .filter((vp) => vp.importance === 'high')
      .map((vp) => vp.point)
      .filter((point) => allMasteryPoints.includes(point))
    const roundNumber = body.rounds.filter((round) => round.answer.trim().length > 0).length + (hasAnswer ? 1 : 0)
    const interactionCount = body.rounds.filter((round) => round.action !== 'clarify').length + (hasAnswer || isSkip ? 1 : 0)
    const isFinal = isSkip
      ? interactionCount >= MAX_INTERVIEW_ROUNDS
      : hasAnswer && shouldFinishInterview(roundNumber, result.isFinal, coveredPoints, importantPoints)

    return NextResponse.json({
      evaluation: {
        score: hasAnswer ? result.evaluation.score : 0,
        coveredPoints,
        missingPoints,
        answerSuggestion: result.evaluation.answerSuggestion,
        evidenceQuotes: hasAnswer
          ? result.evaluation.evidenceQuotes
              .map((q) => q.trim())
              .filter((q) => q && body.answer.includes(q))
              .slice(0, 5)
              .map((q) => q.slice(0, 300))
          : [],
      },
      nextReason: result.nextReason,
      isFinal,
      nextQuestion: isFinal ? '' : (result.nextQuestion || '请再补充一个具体的过程、决策或结果。'),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成下一问失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
