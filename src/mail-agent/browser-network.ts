import { request } from 'node:https'
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib'
import { sourceUrlSchema } from '../domain/mail-schema.ts'
import { resolvePublicHost } from './public-page.ts'

/** Every browser request is fulfilled through a DNS-pinned public HTTPS request. */
export async function readBrowserResource(input: string, method: string, headers: Record<string, string>, body: Buffer | null, deadline: number, resolveHost = resolvePublicHost) {
  const url = new URL(sourceUrlSchema.parse(input))
  if (!['GET', 'POST', 'HEAD'].includes(method) || (body?.length ?? 0) > 1024 * 1024) throw new Error('不支持的网页读取请求')
  if (method === 'POST' && /(?:apply|submit|application|register|login|upload|delete|logout)/i.test(url.pathname)) throw new Error('只读取公开招聘内容，不提交表单')
  const address = await resolveHost(url.hostname, deadline)
  if (Date.now() >= deadline) throw new Error('网页读取超时')
  return new Promise<{ status: number; headers: Record<string, string>; body: Buffer }>((resolve, reject) => {
    const forward = Object.fromEntries(Object.entries(headers).filter(([key]) => !/^(?:host|connection|content-length|accept-encoding|authorization|proxy-authorization|upgrade)$/i.test(key)))
    const req = request(url, { method, agent: false, lookup: (_host, _options, callback) => callback(null, address.address, address.family), family: address.family, headers: { ...forward, 'Accept-Encoding': 'identity', ...(body ? { 'Content-Length': String(body.length) } : {}) } }, response => {
      const chunks: Buffer[] = []; let size = 0
      response.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 24 * 1024 * 1024) { req.destroy(new Error('网页资源超过读取范围')); return }; chunks.push(chunk) })
      response.on('error', reject)
      response.on('end', () => {
        const clean: Record<string, string> = {}
        for (const [key, value] of Object.entries(response.headers)) {
          if (value !== undefined && !/^(?:connection|transfer-encoding|content-length|content-encoding)$/i.test(key)) clean[key] = Array.isArray(value) ? value.join(key === 'set-cookie' ? '\n' : ', ') : value
        }
        try {
          const raw = Buffer.concat(chunks), encoding = response.headers['content-encoding']
          const limit = { maxOutputLength: 24 * 1024 * 1024 }
          const decoded = encoding === 'gzip' ? gunzipSync(raw, limit) : encoding === 'br' ? brotliDecompressSync(raw, limit) : encoding === 'deflate' ? inflateSync(raw, limit) : !encoding || encoding === 'identity' ? raw : null
          if (!decoded) throw new Error('不支持的网页压缩格式')
          resolve({ status: response.statusCode ?? 502, headers: clean, body: decoded })
        } catch { reject(new Error('网页压缩内容无法读取')) }
      })
    })
    const timer = setTimeout(() => req.destroy(new Error('网页资源读取超时')), Math.max(1, Math.min(12000, deadline - Date.now())))
    req.once('close', () => clearTimeout(timer)); req.once('error', reject)
    req.end(body ?? undefined)
  })
}
