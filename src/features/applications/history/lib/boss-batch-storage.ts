import { get, update } from 'idb-keyval'
import type { BrowserRun } from '@/domain/browser-application'
import { changeApplicationProgress } from '@/domain/application-progress'
import { updateApplicationTracker } from './application-tracker-storage'
const KEY = 'application-history:boss-batches:v1'
export async function loadBossBatches() { return await get<BrowserRun[]>(KEY) ?? [] }
/** Only fully verified jobs enter normal application history. Retrying a cache write never resends. */
export async function saveBossBatch(run: BrowserRun) {
  if (run.mode !== 'boss') throw new Error('模拟结果不能写入真实投递记录')
  await updateApplicationTracker(current => {
    const records = [...current.manualApplications], progress = { ...current.progress }
    for (const [index, task] of run.tasks.entries()) {
      if (task.state !== 'verified' || !task.steps.some(step => step.kind === 'contact') || !task.steps.some(step => step.kind === 'greeting') || task.steps.some(step => step.state !== 'verified' || !step.receipt)) continue
      const id = run.id.slice(0, -8) + index.toString(16).padStart(8, '0')
      if (records.some(record => record.id === id)) continue
      const at = task.verifiedAt ?? run.updatedAt
      records.push({ id, company: task.company.slice(0, 120), role: task.title.slice(0, 120), channel: 'boss', sourceUrl: task.url, contact: '', appliedAt: at, createdAt: at, updatedAt: at, note: `BOSS 批次 ${run.id}\n招呼语：${task.steps.find(step => step.kind === 'greeting')?.value ?? ''}\n简历图片：${task.steps.filter(step => step.kind === 'image').length} 张（回执已核对）` })
      progress[id] ??= changeApplicationProgress(undefined, { stage: 'awaiting' }, at)
    }
    return { ...current, manualApplications: records, progress }
  })
  await update<BrowserRun[]>(KEY, current => {
    const runs = current ?? []
    if (runs.some(value => value.id === run.id && value.updatedAt > run.updatedAt)) return runs
    return [run, ...runs.filter(value => value.id !== run.id)].slice(0, 100)
  })
}
