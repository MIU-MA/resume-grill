import { get, update } from 'idb-keyval'
import type { BrowserRun } from '@/domain/browser-application'
const KEY = 'application-history:browser-simulations:v1'
export async function loadBrowserSimulations() { return await get<BrowserRun[]>(KEY) ?? [] }
export function saveBrowserSimulation(run: BrowserRun) {
  if (run.mode !== 'simulation') throw new Error('真实批次不能写入模拟记录')
  return update<BrowserRun[]>(KEY, current => {
    const items = current ?? []
    const previous = items.find(item => item.id === run.id)
    if (previous && previous.updatedAt > run.updatedAt) return items
    return [run, ...items.filter(item => item.id !== run.id)].slice(0, 50)
  })
}
