import { z } from 'zod'
import { assertAllowedBaseUrl } from '@/lib/url-guard'
import { getClientIp, rateLimit, withTimeout } from '@/lib/server-limits'

const credentials = z.object({ baseUrl: z.string().trim().min(1).max(2048), apiKey: z.string().trim().min(1).max(4096) })
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function boundedJson(stream: ReadableStream<Uint8Array> | null, limit: number) {
  const reader = stream?.getReader()
  if (!reader) throw new Error('empty')
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > limit) { await reader.cancel(); throw new Error('size') }
      chunks.push(part.value)
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } finally { reader.releaseLock() }
}

export async function handleModelList(request: Request) {
  const limit = rateLimit(getClientIp(request))
  if (!limit.ok) return json({ error: `请求较多，请 ${limit.retryAfter} 秒后重试。` }, 429)
  let config: z.infer<typeof credentials>
  try { config = credentials.parse(await boundedJson(request.body, 16000)) }
  catch { return json({ error: '请填写接口地址和 API Key。' }, 400) }
  try {
    const base = config.baseUrl.replace(/\/+$/, '')
    const url = new URL(base)
    if (url.username || url.password || url.search || url.hash) throw new Error('接口地址不能包含账号、查询参数或片段。')
    await assertAllowedBaseUrl(base)
  } catch { return json({ error: '接口地址不可用，请检查地址和服务端允许的范围。' }, 400) }
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` }, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.any([request.signal, withTimeout(12000)]),
    })
    if (!response.ok) {
      await response.body?.cancel()
      return json({ error: response.status === 401 || response.status === 403 ? '读取被拒绝，请核对当前供应商的 Key 和权限。' : response.status === 404 || response.status === 405 ? '这个服务没有提供模型列表，可以手动填写型号。' : `服务暂未返回模型列表（${response.status}），可以稍后重试或手动填写。` }, 502)
    }
    const result = z.object({ data: z.array(z.object({ id: z.string().trim().min(1).max(200) }).passthrough()) }).parse(await boundedJson(response.body, 4 * 1024 * 1024))
    const models = [...new Set(result.data.map(model => model.id))].sort((a, b) => a.localeCompare(b)).slice(0, 2000)
    return json({ models })
  } catch { return json({ error: '未能读取模型列表，可以稍后重试或手动填写型号。' }, 502) }
}
