import { get, set } from 'idb-keyval'
import type { AssistantTask } from '@/domain/job-assistant'

export type AssistantStore = { version: 1; goal: string; task: AssistantTask | null }
const KEY = 'job-assistant:v1'
export async function loadAssistantStore(): Promise<AssistantStore> {
  const saved = await get<AssistantStore>(KEY)
  if (!saved) return { version: 1, goal: '', task: null }
  if (saved.version !== 1 || typeof saved.goal !== 'string' || (saved.task && (!Array.isArray(saved.task.sources) || !Array.isArray(saved.task.jobs) || !saved.task.resume?.text))) throw new Error('求职助手记录无法读取，请保留浏览器数据后检查。')
  return { ...saved, task: saved.task ? { ...saved.task,
    status: saved.task.status === 'running' ? 'paused' : saved.task.status,
    message: saved.task.status === 'running' ? '上次任务已中断，已完成的结果已保留，可以继续。' : saved.task.message,
  } : null }
}
export function createAssistantWriter(save: (store: AssistantStore) => Promise<void> = store => set(KEY, store)) {
  let pending = Promise.resolve()
  return (store: AssistantStore) => {
    const write = pending.catch(() => undefined).then(() => save(store))
    pending = write
    return write
  }
}
