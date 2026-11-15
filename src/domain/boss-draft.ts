import { z } from 'zod'
export const bossDraftPreviewSchema = z.object({
  url: z.url().refine(value => { const url = new URL(value); return url.origin === 'https://www.zhipin.com' && /^\/job_detail\/[^/]+\.html$/.test(url.pathname) && !url.search && !url.hash && !url.username && !url.password }),
  company: z.string().trim().min(1).max(200), title: z.string().trim().min(1).max(200), text: z.string().trim().min(1).max(1000),
}).strict()
export type BossComposerState = { chat: boolean; fields: { tag: string; id: string; className: string; role: string | null; placeholder: string | null; editable: boolean; empty: boolean; ancestors: (string | undefined)[] }[]; conversation: string }
export type BossDraftResult = { written: boolean; cleared: boolean; characters: number; sendActionPerformed: false }
export type BossDraftPreview = { id: string; expiresAt: number; company: string; title: string; state: BossComposerState }
