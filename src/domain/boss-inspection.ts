export type BossInspection = {
  kind: 'detail' | 'login' | 'verification' | 'unknown'
  url: string; title: string; company: string; description: string; truncated: boolean
  communication: { count: number; enabled: number; labels: string[] }
  matched: boolean; blockers: string[]
}
