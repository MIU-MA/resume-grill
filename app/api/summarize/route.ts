import { NextResponse } from 'next/server'
import { z } from 'zod'
import { interviewRoundSchema, finalResultSchema } from '@/domain/interview-schema'
import { resumeClaimSchema } from '@/domain/resume-schema'
import { SUMMARIZE_TIMEOUT, getClientIp, rateLimit, withTimeout } from '@/lib/server-limits'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'

const SUMMARIZE_SYSTEM = `你是一名资深面试官，刚结束对候选人简历中一条声明的追问。基于对话历史，给出最终能力评估报告。

澄清轮次（只有批注、没有回答）不算能力不足。
“已掌握，跳过”属于自报状态，不是回答证据，也不代表能力不足。

只输出 JSON 对象，不输出任何解释、推理、Markdown 或额外文字。输出格式：
{"masteryScore":0,"canExplain":[],"cannotExplain":[],"knowledgeGaps":[],"answerSummary":"","nextAction":"","rewriteSuggestion":""}

字段说明：
- masteryScore: 0-5，5=完全经得起追问，0=完全无法回答
- canExplain: 候选人能讲清的
- cannotExplain: 尚未讲清或回避的
- knowledgeGaps: 需要补强的知识点
- answerSummary: 对回答质量和掌握度的短结论
- nextAction: 下一步最具体的补强动作
- rewriteSuggestion: 改写后的简历表述`

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
      .map((r, i) => `第${i + 1}次交互\n操作: ${r.action === 'skip' ? '已掌握，跳过（未验证）' : r.action === 'clarify' ? '请求通俗解释' : '回答'}\n问: ${r.question}\n答: ${r.answer || '(未作答)'}\n不懂批注: ${r.annotation || '(无)'}\n评估: 得分${r.evaluation.score}, 覆盖[${r.evaluation.coveredPoints.join('、')}], 缺失[${r.evaluation.missingPoints.join('、')}]`)
      .join('\n\n')
    const userPrompt = [
      `声明: ${body.claim.content}`,
      `验证要点: ${body.claim.masteryPoints.map((mp) => `[${mp.dimension}] ${mp.point}`).join('、')}`,
      '',
      '对话历史（含每轮评估）：',
      history || '(无追问记录)',
    ].join('\n')

    const result = await llmStructured(
      SUMMARIZE_SYSTEM,
      userPrompt,
      finalResultSchema,
      config,
      { signal: withTimeout(SUMMARIZE_TIMEOUT), maxTokens: 10000 },
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
