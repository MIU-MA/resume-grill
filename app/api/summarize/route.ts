import { NextResponse } from 'next/server'
import { z } from 'zod'
import { interviewRoundSchema, finalResultSchema } from '@/domain/interview-schema'
import { resumeClaimSchema } from '@/domain/resume-schema'
import { SUMMARIZE_TIMEOUT, getClientIp, rateLimit, withTimeout } from '@/lib/server-limits'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'

const SUMMARIZE_SYSTEM = `你是一名资深面试官，刚结束对候选人简历中一条声明的追问。基于对话历史，给出最终风险报告。

严格输出 JSON:
{
  "confidence": 0-5,           // 可信度：5=完全经得起追问, 0=完全无法回答
  "risk": "high|medium|low",
  "canExplain": string[],      // 候选人能解释的
  "cannotExplain": string[],   // 无法解释/回避的
  "suggestions": string[],     // 建议补充的知识或证据
  "rewriteSuggestion": string  // 改写后的简历表述（可直接采用）
}`

const requestSchema = z.object({
  claim: resumeClaimSchema,
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
    const history = body.rounds
      .map((r, i) => `第${i + 1}轮\n问: ${r.question}\n答: ${r.answer}\n评估: 得分${r.evaluation.score}, 覆盖[${r.evaluation.coveredPoints.join('、')}], 缺失[${r.evaluation.missingPoints.join('、')}]`)
      .join('\n\n')
    const userPrompt = [
      `声明: ${body.claim.content}`,
      `验证要点: ${body.claim.evaluationPoints.join('、')}`,
      '',
      '对话历史（含每轮评估）：',
      history || '(无追问记录)',
    ].join('\n')

    const result = await llmStructured(
      SUMMARIZE_SYSTEM,
      userPrompt,
      finalResultSchema,
      config,
      { signal: withTimeout(SUMMARIZE_TIMEOUT), maxTokens: 800 },
    )
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成总结失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
