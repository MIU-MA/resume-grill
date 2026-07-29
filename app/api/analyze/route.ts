import { NextResponse } from 'next/server'
import { z } from 'zod'
import { llmAnalysisSchema, resumeAnalysisSchema } from '@/domain/resume-schema'
import { ANALYZE_SYSTEM_PROMPT, buildAnalyzeUserPrompt } from '@/lib/prompts'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { mockAnalyze } from '@/providers/mock'

const requestSchema = z.object({
  rawText: z.string().min(1, '简历文本不能为空'),
  sourceFile: z.string(),
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
      const partial = await llmStructured(
        ANALYZE_SYSTEM_PROMPT,
        buildAnalyzeUserPrompt(body.rawText),
        llmAnalysisSchema,
        config,
      )
      const analysis = resumeAnalysisSchema.parse({
        ...partial,
        sourceFile: body.sourceFile,
        rawText: body.rawText,
      })
      return NextResponse.json(analysis)
    }

    return NextResponse.json(mockAnalyze(body.rawText, body.sourceFile))
  } catch (error) {
    const message = error instanceof Error ? error.message : '分析失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
