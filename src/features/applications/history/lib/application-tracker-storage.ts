import { get, update } from 'idb-keyval'
import type { ManualApplication } from '@/domain/application-record'
import type { ApplicationProgress } from '@/domain/application-progress'
import type { MailBatch, MailJob } from '@/domain/mail-schema'

export type SubmissionSnapshot = { jobDescription: string; attachment?: File; at: number; channel: 'mail' | 'website' }
export type ApplicationTracker = {
  progress: Record<string, ApplicationProgress>
  mailJobs: MailJob[]
  submissions: Record<string, SubmissionSnapshot>
  /** Applications recorded by hand because the company site had no importable draft. */
  manualApplications: ManualApplication[]
  /** Mail records hidden locally; the executor journal is never rewritten. */
  hiddenMailJobIds: string[]
}
export const APPLICATION_TRACKER_KEY = 'mail-workbench:application-tracker:v1'
export function emptyApplicationTracker(): ApplicationTracker {
  return { progress: {}, mailJobs: [], submissions: {}, manualApplications: [], hiddenMailJobIds: [] }
}
/** Older browsers may have a tracker without the record fields; keep it usable. */
export function normalizeApplicationTracker(value: Partial<ApplicationTracker> | null | undefined): ApplicationTracker {
  return {
    progress: value?.progress ?? {},
    mailJobs: Array.isArray(value?.mailJobs) ? value.mailJobs : [],
    submissions: value?.submissions ?? {},
    manualApplications: Array.isArray(value?.manualApplications)
      ? value.manualApplications.filter((item): item is ManualApplication => !!item && typeof item === 'object' && typeof (item as ManualApplication).id === 'string' && typeof (item as ManualApplication).company === 'string')
      : [],
    hiddenMailJobIds: Array.isArray(value?.hiddenMailJobIds) ? value.hiddenMailJobIds.filter(id => typeof id === 'string') : [],
  }
}
export async function loadApplicationTracker() {
  return normalizeApplicationTracker(await get<Partial<ApplicationTracker>>(APPLICATION_TRACKER_KEY))
}
/** Atomic read/modify/write preserves simultaneous edits, submissions and agent updates. */
export async function updateApplicationTracker(change: (current: ApplicationTracker) => ApplicationTracker) {
  let saved!: ApplicationTracker
  await update<Partial<ApplicationTracker>>(APPLICATION_TRACKER_KEY, current => { saved = change(normalizeApplicationTracker(current)); return saved })
  return saved
}
export function captureMailSubmissions(batch: MailBatch, descriptions: Record<string, string>, now: number) {
  return Object.fromEntries(batch.jobs.map(job => {
    const value = job.attachment ?? batch.attachment
    const bytes = Uint8Array.from(atob(value.base64), character => character.charCodeAt(0))
    return [job.id, { jobDescription: descriptions[job.id] ?? '', attachment: new File([bytes], value.name), at: now, channel: 'mail' as const }]
  }))
}
