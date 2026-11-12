import { resumeSnapshotInput } from '@/domain/resume-snapshot'

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

async function boundedText(body: ReadableStream<Uint8Array> | null, limit: number) {
  if (!body) return ''
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) return text + decoder.decode()
      size += chunk.value.byteLength
      if (size > limit) { await reader.cancel(); throw new RangeError('body too large') }
      text += decoder.decode(chunk.value, { stream: true })
    }
  } finally { reader.releaseLock() }
}

const error = (status: number, message: string) => Response.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } })

/** Fixed loopback destination; the service token stays on the Next.js server. */
export async function proxyResumeSnapshot(request: Request, id?: string): Promise<Response> {
  const url = new URL(request.url)
  const origin = request.headers.get('origin')
  const site = request.headers.get('sec-fetch-site')
  if (!localHosts.has(url.hostname) || (origin && origin !== url.origin) || (site && !['same-origin', 'none'].includes(site)) || (request.method === 'POST' && origin !== url.origin)) {
    return error(403, '此功能仅支持从本机工作台访问。')
  }
  if (!['GET', 'POST'].includes(request.method) || (id && !/^[a-f0-9]{32}$/.test(id))) return error(400, '请求无效。')
  const token = process.env.WORKBENCH_TOKEN ?? ''
  const port = process.env.WORKBENCH_PORT ?? '3108'
  if (token.length < 32) return error(503, '尚未配置本机文本备份，请按 Go 服务说明配置访问令牌。')
  if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) return error(503, '本机服务端口配置无效。')
  let body: string | undefined
  if (request.method === 'POST') {
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return error(415, '请使用 JSON 请求。')
    try { body = JSON.stringify(resumeSnapshotInput.parse(JSON.parse(await boundedText(request.body, 2 * 1024 * 1024)))) }
    catch (cause) { return error(cause instanceof RangeError ? 413 : 400, '简历为空、过长或格式无效。') }
  }
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/resumes${id ? `/${id}` : ''}`, {
      method: request.method, body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(7000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
    if (!response.ok) {
      await response.body?.cancel()
      if (response.status === 401) return error(502, '工作台与 Go 服务的访问令牌不一致。')
      return error([400, 404, 413, 415, 503].includes(response.status) ? response.status : 502, response.status === 404 ? '这份备份不存在。' : '本机服务未完成操作，请重试。')
    }
    const result = await boundedText(response.body, 8 * 1024 * 1024)
    return new Response(result, { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  } catch {
    return error(503, request.method === 'POST'
      ? '未能确认是否保存成功，请刷新备份列表核对后再重试。也请检查 Go 服务是否已启动、端口是否正确。'
      : '无法连接 Go 服务，请确认服务已启动、端口正确。')
  }
}
