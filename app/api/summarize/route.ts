import { NextResponse } from 'next/server'
import { z } from 'zod'
import { interviewRoundSchema, finalResultSchema } from '@/domain/interview-schema'
import { resumeClaimSchema } from '@/domain/resume-schema'
import { SUMMARIZE_TIMEOUT, getClientIp, rateLimit, withTimeout } from '@/lib/server-limits'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { RESUME_COACH_STYLE } from '@/lib/prompt-style'

const SUMMARIZE_SYSTEM = `你刚陪求职者练完简历中的一段经历。根据问答记录，帮用户回顾已经讲清的细节、还需补充的内容，以及下次怎么回答。

${RESUME_COACH_STYLE}

澄清轮次（只有批注、没有回答）不算能力不足。
“已掌握，跳过”属于自报状态，不是回答证据，也不代表能力不足。

只输出 JSON 对象，不输出任何解释、推理、Markdown 或额外文字。输出格式：
{"masteryScore":0,"canExplain":[],"cannotExplain":[],"knowledgeGaps":[],"answerSummary":"","nextAction":"","rewriteSuggestion":""}

字段说明：
- masteryScore: 0-5，只针对这次练习，5=问到的关键细节已讲清，0=没有可判断的回答。不能据此判定用户的实际能力。
- canExplain: 回答中已经讲清的具体内容，每项简短，不泛泛夸奖
- cannotExplain: 问到了但还没讲清的具体内容；没问到、请求解释或跳过的不能直接算不会
- knowledgeGaps: 回答中确实暴露出需要复习的知识，写具体概念或问题，没有则返回空数组
- answerSummary: 用 2-3 句指出哪次回答讲清了什么、哪处还缺细节，不写“综合来看，候选人展现了……”
- nextAction: 一件现在能做的准备工作，说明要回看哪个做法、找什么材料或重讲哪个问题，不写笼统的“加强学习”
- rewriteSuggestion: 根据原简历和本次回答，给这条经历一个简洁的改写建议。只重组已经提供的事实，不添加职责、技术、结果或数字；待确认处用【待补充：具体信息】标记`

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
