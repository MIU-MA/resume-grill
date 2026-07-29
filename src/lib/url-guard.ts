// 服务端 SSRF 防护：限制自定义 Base URL 只能访问公网/受信任地址。
// 策略（与用户确认一致）：
// 1) 若设了 env ALLOWED_LLM_BASE_URLS（逗号分隔 origin），origin 必须命中白名单才放行
//    —— 命中即视为管理员显式信任，即便指向内网/本机也允许（用于自建局域网/本机模型）。
// 2) 未设白名单时放行公网，但硬阻断内网/保留地址：IP 字面量直接判段；域名做 DNS 解析后再判段（防 DNS 重绑定）。
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const RESERVED_HOSTNAMES = new Set([
  'metadata.google.internal', // GCP 元数据
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
  if (a === 127) return true // 回环
  if (a === 10) return true // 私网 10/8
  if (a === 0) return true // "this" 网络
  if (a === 169 && b === 254) return true // 链路本地 + 云元数据 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true // 私网 172.16/12
  if (a === 192 && b === 168) return true // 私网 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64/10
  return false
}

function isReservedIPv6(ip: string): boolean {
  const v = ip.toLowerCase()
  if (v === '::1' || v === '::') return true // 回环 / 未指定
  const mapped = v.match(/^(?:::ffff:|64:ff9b::)(\d{1,3}(?:\.\d{1,3}){3})$/) // IPv4 映射地址
  if (mapped) {
    const o = parseIPv4(mapped[1])
    return o ? isPrivateIPv4(o) : false
  }
  if (v.startsWith('fc') || v.startsWith('fd')) return true // 唯一本地 fc00::/7
  if (v.startsWith('fe80')) return true // 链路本地
  if (v.startsWith('ff')) return true // 多播
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

// 在 llmStructured 发起 fetch 前调用；违例抛出中文错误，由路由转成对客户端的提示。
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
    if (!origins.includes(`${url.protocol}//${host}`)) {
      throw new Error('该 Base URL 不在服务端允许的白名单内')
    }
    // 命中白名单：管理员显式信任，放行（即便指向内网/本机）。
    return
  }

  // 未设白名单：放行公网，阻断内网/保留地址。
  if (RESERVED_HOSTNAMES.has(host)) throw new Error('不允许访问该地址')
  if (isIP(host)) {
    if (isReservedIp(host)) {
      throw new Error('不允许访问内网/保留地址（自建模型请配置 ALLOWED_LLM_BASE_URLS 白名单）')
    }
    return
  }

  // 域名：解析后逐个判段，防止 DNS 重绑定到内网。
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
