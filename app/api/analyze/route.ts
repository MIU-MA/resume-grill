import { NextResponse } from 'next/server'
import { z } from 'zod'
import { attachClaimIds, compactAnalysisSchema, computeTestPriority, repairCompactAnalysis, resumeAnalysisSchema } from '@/domain/resume-schema'
import { ANALYZE_SYSTEM_PROMPT, buildAnalyzeUserPrompt } from '@/lib/prompts'
import { ANALYZE_TIMEOUT, MAX_RAWTEXT, getClientIp, rateLimit, withTimeout } from '@/lib/server-limits'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { mockAnalyze } from '@/providers/mock'
import { isExcludedClaimContent } from '@/lib/claim-filter'
import { extractResumeClaimCandidates, isClaimGroundedInRawText, matchClaimCandidate } from '@/lib/resume-structure'
import { analysisGoalSchema, goalClaimCount, reviewedCandidateSchema } from '@/domain/analysis-config'
import { buildHeuristicJobMatch } from '@/lib/job-match'

const requestSchema = z.object({
  rawText: z.string().min(1, '简历文本不能为空').max(MAX_RAWTEXT, `简历文本过长，请控制在 ${MAX_RAWTEXT} 字以内`),
  sourceFile: z.string(),
  analysisGoal: analysisGoalSchema.default('overall'),
  reviewedCandidates: z.array(reviewedCandidateSchema).min(1).max(80).optional(),
  jobDescription: z.string().trim().max(12000).optional(),
  llm: z
    .object({
      baseUrl: z.string().optional(),
      apiKey: z.string().optional(),
      model: z.string().optional(),
    })
    .optional(),
  demo: z.boolean().optional(),
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
    if (body.demo) {
      return NextResponse.json(mockAnalyze(body.rawText, body.sourceFile, {
        analysisGoal: body.analysisGoal,
        candidates: body.reviewedCandidates,
        jobDescription: body.jobDescription,
      }))
    }

    const rawCandidates = body.reviewedCandidates ?? extractResumeClaimCandidates(body.rawText)
    const promptCandidates = rawCandidates.slice(0, 20)
    const config = resolveLlmConfig(body.llm ?? null)
    if (config) {
      const compact = await llmStructured(
        ANALYZE_SYSTEM_PROMPT,
        buildAnalyzeUserPrompt(body.rawText, promptCandidates, body.analysisGoal),
        compactAnalysisSchema,
        config,
        { signal: withTimeout(ANALYZE_TIMEOUT), maxTokens: 24000, repair: (value) => repairCompactAnalysis(value, goalClaimCount(body.analysisGoal)) },
      )

      const backfilledClaims = compact.claims.flatMap((claim) => {
        const source = promptCandidates[claim.candidateIndex]
        if (!source) return []

        return [{
          content: source.content,
          sourceSection: source.sourceSection,
          title: claim.capability,
          category: claim.category,
          role: compact.role,
          capability: claim.capability,
          masteryPoints: claim.masteryPoints,
          initialQuestion: claim.initialQuestion,
          initialIntent: `这次先聊：${claim.masteryPoints[0]?.point ?? '这段经历的具体做法'}`,
          trapPoints: claim.trapPoints,
          testPriority: computeTestPriority(claim.masteryPoints),
        }]
      })

      const filteredClaims = backfilledClaims.flatMap((claim) => {
        if (isExcludedClaimContent(claim.content)) return []
        const source = matchClaimCandidate(claim.content, rawCandidates)
        if (!source && (body.reviewedCandidates || !isClaimGroundedInRawText(claim.content, body.rawText))) return []
        return [{ ...claim, sourceSection: (source?.sourceSection ?? claim.sourceSection.trim()) || '经历内容' }]
      })

      const seen = new Set<string>()
      const uniqueClaims = filteredClaims.filter((claim) => {
        const key = `${claim.sourceSection}\n${claim.content.replace(/\s+/g, '')}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      if (uniqueClaims.length === 0) {
        throw new Error('没找到可以练习的经历，请检查导入的文字里是否有具体工作或项目。')
      }

      const analysis = resumeAnalysisSchema.parse({
        ...compact,
        claims: attachClaimIds(uniqueClaims),
        sourceFile: body.sourceFile,
        rawText: body.rawText,
        analysisGoal: body.analysisGoal,
        reviewedCandidates: body.reviewedCandidates,
        jobDescription: body.jobDescription,
        jobMatch: body.jobDescription
          ? buildHeuristicJobMatch(body.jobDescription, rawCandidates)
          : undefined,
      })
      return NextResponse.json(analysis)
    }

    return NextResponse.json(
      { error: '请先在「模型设置」里填写 API Key、模型和服务地址，再生成练习清单。试用示例简历无需配置。' },
      { status: 400 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : '分析失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
