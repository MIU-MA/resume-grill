import { NextResponse } from 'next/server'
import { z } from 'zod'
import { groundedDiagnosisSchema, sortDiagnosisIssues } from '@/domain/resume-diagnosis'
import { DIAGNOSIS_SYSTEM_PROMPT, buildDiagnosisUserPrompt, buildDemoDiagnosis } from '@/lib/resume-diagnosis'
import { MAX_RAWTEXT, getClientIp, rateLimit, withTimeout } from '@/lib/server-limits'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'

export const runtime = 'nodejs'
export const maxDuration = 120
const MAX_BODY_BYTES = 256_000
const requestSchema = z.object({
  rawText: z.string().trim().min(1).max(MAX_RAWTEXT),
  jobDescription: z.string().trim().max(12_000).default(''),
  demo: z.boolean().default(false),
  llm: z.object({
    baseUrl: z.string().trim().min(1).max(2048),
    apiKey: z.string().trim().min(1).max(4096),
    model: z.string().trim().min(1).max(200),
  }).optional(),
})

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })

async function readBody(request: Request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new RangeError('请求内容过大')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('缺少请求内容')
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY_BYTES) {
        await reader.cancel()
        throw new RangeError('请求内容过大')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

export async function POST(request: Request) {
  const limit = rateLimit(getClientIp(request))
  if (!limit.ok) return json({ error: `请求过于频繁，请 ${limit.retryAfter} 秒后重试` }, 429, { 'Retry-After': String(limit.retryAfter) })

  let body: z.infer<typeof requestSchema>
  try {
    body = requestSchema.parse(await readBody(request))
  } catch (error) {
    return json({ error: error instanceof RangeError ? '请求内容过大，请缩短简历或岗位描述。' : `请提供有效简历（最多 ${MAX_RAWTEXT} 字）、岗位描述（最多 12000 字）和完整模型配置。` }, error instanceof RangeError ? 413 : 400)
  }

  if (body.demo) return json(buildDemoDiagnosis(body.rawText))
  const config = resolveLlmConfig(body.llm)
  if (!config) return json({ error: '请先配置模型，再检查简历。' }, 400)

  const signal = AbortSignal.any([request.signal, withTimeout(90_000)])
  try {
    const result = await llmStructured(
      DIAGNOSIS_SYSTEM_PROMPT,
      buildDiagnosisUserPrompt(body.rawText, body.jobDescription),
      groundedDiagnosisSchema(body.rawText, body.jobDescription),
      config,
      { signal, maxTokens: 8000 },
    )
    return json({ ...result, issues: sortDiagnosisIssues(result.issues), source: 'model' })
  } catch {
    return json({ error: signal.aborted
      ? '检查已取消或超时，请稍后重试。'
      : '这次没能生成检查结果，请确认模型连接后重试，也可以先选择练习内容。' }, signal.aborted ? 504 : 502)
  }
}
