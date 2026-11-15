export type BossConnection = { origin: string; token: string }
export type BossStatus = { ready: boolean; browserConnected?: boolean; phase: string; error: string; tabs: { id: string; title: string }[] }
const KEY = 'boss-browser:connection:v1'

export function parseBossConnection(link: string): BossConnection {
  const url = new URL(link)
  const token = new URLSearchParams(url.hash.slice(1)).get('boss-token') ?? ''
  const origin = new URLSearchParams(url.hash.slice(1)).get('boss-origin') ?? 'http://127.0.0.1:4327'
  const endpoint = new URL(origin)
  if (endpoint.protocol !== 'http:' || endpoint.hostname !== '127.0.0.1' || endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash || !/^[a-f0-9]{48}$/.test(token)) throw new Error('请粘贴本机浏览器服务输出的完整工作台链接。')
  return { origin: endpoint.origin, token }
}
export function restoreBossConnection(): BossConnection | null {
  if (location.hash.includes('boss-token=')) {
    const connection = parseBossConnection(location.href)
    history.replaceState(history.state, '', location.pathname + location.search)
    sessionStorage.setItem(KEY, JSON.stringify(connection))
    return connection
  }
  const saved = sessionStorage.getItem(KEY)
  if (!saved) return null
  const value = JSON.parse(saved) as BossConnection
  return parseBossConnection(`http://localhost/boss#boss-token=${value.token}&boss-origin=${encodeURIComponent(value.origin)}`)
}
export function rememberBossConnection(connection: BossConnection) { sessionStorage.setItem(KEY, JSON.stringify(connection)) }
export async function bossRequest<T>(connection: BossConnection, path: string, body?: unknown): Promise<T> {
  const response = await fetch(connection.origin + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${connection.token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000),
    credentials: 'omit', referrerPolicy: 'no-referrer',
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '本机浏览器服务未响应')
  return result as T
}
