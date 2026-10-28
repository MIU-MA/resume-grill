import { NextResponse } from 'next/server'
import { z } from 'zod'
import { usableTailoringSchema } from '@/domain/resume-tailoring'
import { TAILORING_SYSTEM_PROMPT, buildTailoringPrompt } from '@/features/resume/lib/resume-tailoring-prompt'
import { getClientIp, rateLimit, withTimeout, MAX_RAWTEXT } from '@/lib/server-limits'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'

export const runtime = 'nodejs'
export const maxDuration = 120
const schema = z.object({
  rawText: z.string().trim().min(1).max(MAX_RAWTEXT),
  jobDescription: z.string().trim().min(1).max(12000),
  llm: z.object({ baseUrl: z.string().trim().min(1).max(2048), apiKey: z.string().trim().min(1).max(4096), model: z.string().trim().min(1).max(200) }).optional(),
}).strict()
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
async function readBody(request: Request) {
  const limit = 256000
  if (Number(request.headers.get('content-length')) > limit) throw new RangeError()
  const reader = request.body?.getReader()
  if (!reader) throw new Error()
  const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > limit) { await reader.cancel(); throw new RangeError() }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}
export async function POST(request: Request) {
  const limit = rateLimit(getClientIp(request))
  if (!limit.ok) return json({ error: `请求过于频繁，请 ${limit.retryAfter} 秒后重试。` }, 429, { 'Retry-After': String(limit.retryAfter) })
  let body: z.infer<typeof schema>
  try { body = schema.parse(await readBody(request)) }
  catch (error) { return json({ error: '请提供有效简历、12000 字以内的 JD 和完整模型配置。' }, error instanceof RangeError ? 413 : 400) }
  const config = resolveLlmConfig(body.llm)
  if (!config) return json({ error: '请先在模型设置中配置模型，再生成岗位版简历。' }, 400)
  const signal = AbortSignal.any([request.signal, withTimeout(90000)])
  try {
    const plan = await llmStructured(TAILORING_SYSTEM_PROMPT, buildTailoringPrompt(body.rawText, body.jobDescription), usableTailoringSchema(body.rawText, body.jobDescription), config, { signal })
    return json(plan)
  } catch { return json({ error: signal.aborted ? '生成已取消或超时，可以重试。' : '未能生成可核对的修改稿，请检查模型连接后重试。' }, signal.aborted ? 504 : 502) }
}
