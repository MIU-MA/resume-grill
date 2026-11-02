import { get, set } from 'idb-keyval'
import type { CachedCareerSite, CareerJobsStore } from './career-jobs'
import { emptyCareerJobs } from './career-jobs'

const KEY = 'mail-workbench:career-jobs:v1'
export function normalizeCareerJobs(value: unknown): CareerJobsStore {
  if (!value || typeof value !== 'object') return emptyCareerJobs()
  const sites = (value as { sites?: unknown }).sites
  if (!sites || typeof sites !== 'object') return emptyCareerJobs()
  const next: Record<string, CachedCareerSite> = {}
  for (const [siteKey, raw] of Object.entries(sites as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue
    const site = raw as Partial<CachedCareerSite>
    if (!site.url || !site.company) continue
    next[siteKey] = {
      company: site.company,
      url: site.url,
      fetchedAt: Number(site.fetchedAt) || 0,
      status: site.status === 'failed' ? 'failed' : 'ok',
      pagesRead: Number(site.pagesRead) || 0,
      pages: Array.isArray(site.pages) ? site.pages.filter(page => page && typeof page.url === 'string') : [],
      links: Array.isArray(site.links) ? site.links.filter(link => link && typeof link.url === 'string') : [],
      notes: Array.isArray(site.notes) ? site.notes : [],
      ...(site.error ? { error: site.error } : {}),
    }
  }
  return { version: 1, sites: next }
}
export async function loadCareerJobs(): Promise<CareerJobsStore> {
  return normalizeCareerJobs(await get<unknown>(KEY))
}
export function createCareerJobsWriter(save: (store: CareerJobsStore) => Promise<void> = store => set(KEY, store)) {
  let pending = Promise.resolve()
  return (store: CareerJobsStore) => {
    const write = pending.catch(() => undefined).then(() => save(store))
    pending = write
    return write
  }
}
