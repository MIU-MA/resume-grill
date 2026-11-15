import { z } from 'zod'

export const simulationBatchSchema = z.object({
  id: z.uuid(),
  jobs: z.array(z.object({
    url: z.url().refine(value => { const url = new URL(value); return url.origin === 'https://www.zhipin.com' && /^\/job_detail\/[^/]+\.html$/.test(url.pathname) && !url.search && !url.hash && !url.username && !url.password }),
    company: z.string().max(200), title: z.string().min(1).max(200), greeting: z.string().trim().min(1).max(1000),
  }).strict()).min(1).max(30),
  images: z.array(z.object({ name: z.string().min(1).max(180), type: z.enum(['image/png', 'image/jpeg']), sha256: z.string().regex(/^[a-f0-9]{64}$/), base64: z.string().min(4).max(7 * 1024 * 1024).regex(/^[A-Za-z0-9+/]+={0,2}$/) }).strict()).max(3),
}).strict().refine(value => new Set(value.jobs.map(job => job.url)).size === value.jobs.length, '同一批次不能重复选择岗位')
export type SimulationBatch = z.infer<typeof simulationBatchSchema>
export type BrowserStep = { id: string; kind: 'contact' | 'greeting' | 'image'; value: string; state: 'pending' | 'sending' | 'verified' | 'uncertain'; receipt?: string }
export type BrowserTask = { verifiedAt?: number; url: string; company: string; title: string; state: 'queued' | 'running' | 'verified' | 'failed' | 'uncertain'; error?: string; steps: BrowserStep[] }
export type BrowserRun = { id: string; mode: 'simulation' | 'boss'; state: 'running' | 'paused' | 'finished' | 'failed'; createdAt: number; updatedAt: number; tasks: BrowserTask[]; error?: string }
export const BROWSER_TASK_LABELS = { queued: '未执行', running: '执行中', verified: '已核验（模拟）', failed: '执行失败', uncertain: '结果待核对' } as const

export type BossBatchPreview = { id: string; batchId: string; expiresAt: number; jobs: SimulationBatch['jobs']; images: Omit<SimulationBatch['images'][number], 'base64'>[]; skipped: { url: string; title: string; reason: string }[] }
