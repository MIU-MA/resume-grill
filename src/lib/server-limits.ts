
export const MAX_RAWTEXT = 20_000 // 简历文本字符上限
export const MAX_TURNS = 40 // 历史交互上限，留出不计入追问次数的解释轮次
export const MAX_ANSWER = 4_000 // 单轮答案字符上限
export const ANALYZE_TIMEOUT = 120_000
export const INTERVIEW_TIMEOUT = 90_000
export const SUMMARIZE_TIMEOUT = 45_000

const WINDOW_MS = 60_000
const MAX_REQS = 10 // 每个 IP 每分钟最多 10 次模型请求

const hits = new Map<string, number[]>()

export function getClientIp(request: Request): string {
  const headers = request.headers
  const fwd = headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return headers.get('x-real-ip')?.trim() || 'unknown'
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfter: number }

export function rateLimit(key: string): RateLimitResult {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= MAX_REQS) {
    return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - recent[0])) / 1000) }
  }
  recent.push(now)
  hits.set(key, recent)
  return { ok: true }
}

export function withTimeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms)
}

export async function readLimitedJson(request: Request, maxBytes: number): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > maxBytes) throw new RangeError('请求内容过大')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('缺少请求内容')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new RangeError('请求内容过大')
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
