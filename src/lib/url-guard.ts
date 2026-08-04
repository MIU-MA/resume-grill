import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const RESERVED_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata',
  'metadata.aws.internal',
])

function parseIPv4(s: string): number[] | null {
  const parts = s.split('.')
  if (parts.length !== 4) return null
  const octets = parts.map((p) => Number(p))
  if (octets.some((o) => Number.isNaN(o) || o < 0 || o > 255)) return null
  return octets
}

function isPrivateIPv4(octets: number[]): boolean {
  const [a, b] = octets
  if (a === 127) return true
  if (a === 10) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  return false
}

function isReservedIPv6(ip: string): boolean {
  const v = ip.toLowerCase()
  if (v === '::1' || v === '::') return true
  const mapped = v.match(/^(?:::ffff:|64:ff9b::)(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (mapped) {
    const o = parseIPv4(mapped[1])
    return o ? isPrivateIPv4(o) : false
  }
  if (v.startsWith('fc') || v.startsWith('fd')) return true
  if (v.startsWith('fe80')) return true
  if (v.startsWith('ff')) return true
  return false
}

function isReservedIp(ip: string): boolean {
  const family = isIP(ip)
  if (family === 4) {
    const o = parseIPv4(ip)
    return o ? isPrivateIPv4(o) : false
  }
  if (family === 6) return isReservedIPv6(ip)
  return false
}

function originOf(s: string): string {
  try {
    return new URL(s).origin
  } catch {
    return s
  }
}

export async function assertAllowedBaseUrl(rawBaseUrl: string): Promise<void> {
  let url: URL
  try {
    url = new URL(rawBaseUrl)
  } catch {
    throw new Error('Base URL 格式不合法')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Base URL 仅支持 http/https')
  }
  const host = url.hostname.toLowerCase()

  const allowRaw = process.env.ALLOWED_LLM_BASE_URLS
  if (allowRaw) {
    const origins = allowRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map(originOf)
    if (!origins.includes(url.origin)) {
      throw new Error('该 Base URL 不在服务端允许的白名单内')
    }
    return
  }

  if (RESERVED_HOSTNAMES.has(host)) throw new Error('不允许访问该地址')
  if (isIP(host)) {
    if (isReservedIp(host)) {
      throw new Error('不允许访问内网/保留地址（自建模型请配置 ALLOWED_LLM_BASE_URLS 白名单）')
    }
    return
  }

  let addresses: { address: string }[]
  try {
    addresses = await lookup(host, { all: true })
  } catch {
    throw new Error(`无法解析 Base URL 主机名：${host}`)
  }
  if (addresses.length === 0) throw new Error(`无法解析 Base URL 主机名：${host}`)
  for (const a of addresses) {
    if (isReservedIp(a.address)) {
      throw new Error('Base URL 解析到内网/保留地址，已拒绝')
    }
  }
}
