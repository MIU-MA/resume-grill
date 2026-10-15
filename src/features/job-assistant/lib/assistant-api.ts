import { z } from 'zod'
import { careerSites } from '@/data/career-sites'
import { sourceUrlSchema } from '@/domain/mail-schema'
import { assistantPlanSchema, groundedAssessments, matchingJobSchema } from '@/domain/job-assistant'
import { getClientIp, MAX_RAWTEXT, rateLimit, withTimeout } from '@/lib/server-limits'
import { llmStructured, resolveLlmConfig } from '@/providers/openai-compatible'
import { ASSISTANT_MATCH_PROMPT, ASSISTANT_PLAN_PROMPT } from './assistant-prompts'

const common = {
  goal: z.string().trim().min(1).max(2000), resume: z.string().trim().min(1).max(MAX_RAWTEXT),
  llm: z.object({ baseUrl: z.string().min(1).max(2048), apiKey: z.string().min(1).max(4096), model: z.string().min(1).max(200) }).optional(),
}
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('plan'), ...common }),
  z.object({ action: z.literal('match'), ...common, plan: assistantPlanSchema, jobs: z.array(matchingJobSchema).min(1).max(5) }),
])
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } })

async function readBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('缺少请求')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > 350_000) { await reader.cancel(); throw new RangeError('请求过大') }
      chunks.push(next.value)
    }
  } finally { reader.releaseLock() }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

export function assistantSources(goal: string) {
  const urls = [...new Set((goal.match(/https:\/\/[^\s<>"，。；）]+/g) ?? []).filter(url => sourceUrlSchema.safeParse(url).success))].slice(0, 5)
  return [...urls.map(url => ({ company: new URL(url).hostname, url, supplied: true })), ...careerSites.filter(site => !urls.includes(site.url))]
}

export async function handleAssistantRequest(request: Request) {
  const limit = rateLimit(getClientIp(request))
  if (!limit.ok) return json({ error: `请求较多，请 ${limit.retryAfter} 秒后继续任务。` }, 429, { 'Retry-After': String(limit.retryAfter) })
  let body: z.infer<typeof schema>
  try { body = schema.parse(await readBody(request)) }
  catch (error) { return json({ error: error instanceof RangeError ? '内容过长，请减少岗位或简历文字。' : '请填写求职目标并选择有效简历。' }, error instanceof RangeError ? 413 : 400) }
  const config = resolveLlmConfig(body.llm)
  if (!config) return json({ error: '请先在模型设置中配置模型，再运行求职助手。' }, 400)
  const signal = AbortSignal.any([request.signal, withTimeout(90_000)])
  try {
    if (body.action === 'plan') {
      const sources = assistantSources(body.goal)
      const allowed = new Set(sources.map(source => source.url))
      const planSchema = assistantPlanSchema.superRefine((plan, context) => {
        if (plan.sourceUrls.some(url => !allowed.has(url))) context.addIssue({ code: 'custom', message: '来源不在官网清单中' })
      })
      const plan = await llmStructured(ASSISTANT_PLAN_PROMPT, JSON.stringify({ goal: body.goal, resume: body.resume, sources }), planSchema, config, { signal })
      const selected = [...new Set(plan.sourceUrls)].map(url => sources.find(source => source.url === url)!)
        .filter(source => !plan.excludedCompanies.some(company => source.company.toLowerCase().includes(company.toLowerCase())))
      if (!selected.length) return json({ error: '可选官网都被排除了，请在目标中补充公司官网链接。' }, 422)
      return json({ plan: { ...plan, sourceUrls: selected.map(source => source.url) }, sources: selected.map(({ company, url }) => ({ company, url })) })
    }
    const result = await llmStructured(ASSISTANT_MATCH_PROMPT, JSON.stringify({ goal: body.goal, plan: body.plan, resume: body.resume, jobs: body.jobs }), groundedAssessments(body.resume, body.jobs), config, { signal })
    return json(result)
  } catch {
    return json({ error: signal.aborted ? '分析已取消或超时，已完成的结果会保留。' : '这次分析没有通过原文核对，请检查模型连接后继续任务。' }, signal.aborted ? 504 : 502)
  }
}
