import { NextResponse } from 'next/server'
import { z } from 'zod'
import { attachClaimIds, llmAnalysisSchema, resumeAnalysisSchema } from '@/domain/resume-schema'
import { ANALYZE_SYSTEM_PROMPT, buildAnalyzeUserPrompt } from '@/lib/prompts'
import { ANALYZE_TIMEOUT, MAX_RAWTEXT, getClientIp, rateLimit, withTimeout } from '@/lib/server-limits'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { mockAnalyze } from '@/providers/mock'
import { isExcludedClaimContent } from '@/lib/claim-filter'
import { extractResumeClaimCandidates, isClaimGroundedInRawText, matchClaimCandidate } from '@/lib/resume-structure'
import { analysisGoalSchema, reviewedCandidateSchema } from '@/domain/analysis-config'
import { buildHeuristicJobMatch } from '@/lib/job-match'

const requestSchema = z.object({
  rawText: z.string().min(1, '简历文本不能为空').max(MAX_RAWTEXT, `简历文本过长，请控制在 ${MAX_RAWTEXT} 字以内`),
  sourceFile: z.string(),
  analysisGoal: analysisGoalSchema.default('overall'),
  reviewedCandidates: z.array(reviewedCandidateSchema).min(1).max(80).optional(),
  jobDescription: z.string().trim().max(12000).optional(),
  // 可选：前端在设置页填入的 Key；未填则回落服务端 env，再无则走规则示例。
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
    const candidates = body.reviewedCandidates ?? extractResumeClaimCandidates(body.rawText)
    const config = resolveLlmConfig(body.llm ?? null)
    if (config) {
      const partial = await llmStructured(
        ANALYZE_SYSTEM_PROMPT,
        buildAnalyzeUserPrompt(body.rawText, {
          analysisGoal: body.analysisGoal,
          reviewedCandidates: body.reviewedCandidates,
          jobDescription: body.jobDescription,
        }),
        llmAnalysisSchema,
        config,
        { signal: withTimeout(ANALYZE_TIMEOUT), maxTokens: 4000 },
      )
      const filteredClaims = partial.claims.flatMap((claim) => {
        if (isExcludedClaimContent(claim.content)) return []
        const source = matchClaimCandidate(claim.content, candidates)
        if (!source && (body.reviewedCandidates || !isClaimGroundedInRawText(claim.content, body.rawText))) return []
        return [{
          ...claim,
          sourceSection: (source?.sourceSection ?? claim.sourceSection.trim()) || '经历内容',
        }]
      })
      const seen = new Set<string>()
      const uniqueClaims = filteredClaims.filter((claim) => {
        const key = `${claim.sourceSection}\n${claim.content.replace(/\s+/g, '')}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      if (uniqueClaims.length === 0) {
        throw new Error('未识别到可验证的经历陈述，请检查简历正文是否包含具体职责、行动或成果。')
      }
      const analysis = resumeAnalysisSchema.parse({
        ...partial,
        claims: attachClaimIds(uniqueClaims),
        sourceFile: body.sourceFile,
        rawText: body.rawText,
        analysisGoal: body.analysisGoal,
        reviewedCandidates: body.reviewedCandidates,
        jobDescription: body.jobDescription,
        jobMatch: body.jobDescription
          ? partial.jobMatch ?? buildHeuristicJobMatch(body.jobDescription, candidates)
          : undefined,
      })
      return NextResponse.json(analysis)
    }

    return NextResponse.json(mockAnalyze(body.rawText, body.sourceFile, {
      analysisGoal: body.analysisGoal,
      candidates: body.reviewedCandidates,
      jobDescription: body.jobDescription,
    }))
  } catch (error) {
    const message = error instanceof Error ? error.message : '分析失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
