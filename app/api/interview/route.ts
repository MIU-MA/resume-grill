import { NextResponse } from 'next/server'
import { z } from 'zod'
import { interviewTurnSchema, nextQuestionSchema } from '@/domain/interview-schema'
import { resumeClaimSchema } from '@/domain/resume-schema'
import { INTERVIEW_SYSTEM_PROMPT, buildInterviewUserPrompt } from '@/lib/prompts'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { mockNextQuestion } from '@/providers/mock'

const requestSchema = z.object({
  claim: resumeClaimSchema,
  turns: z.array(interviewTurnSchema).default([]),
  llm: z
    .object({
      baseUrl: z.string().optional(),
      apiKey: z.string().optional(),
      model: z.string().optional(),
    })
    .optional(),
})

export async function POST(request: Request) {
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
      )
      return NextResponse.json(next)
    }

    return NextResponse.json(mockNextQuestion(body.claim, body.turns))
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成下一问失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
