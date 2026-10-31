import { get, update } from 'idb-keyval'
import type { ApplicationProgress } from '@/domain/application-progress'
import type { MailBatch, MailJob } from '@/domain/mail-schema'

export type SubmissionSnapshot = { jobDescription: string; attachment?: File; at: number; channel: 'mail' | 'website' }
export type ApplicationTracker = {
  progress: Record<string, ApplicationProgress>
  mailJobs: MailJob[]
  submissions: Record<string, SubmissionSnapshot>
}
const KEY = 'mail-workbench:application-tracker:v1'
export function emptyApplicationTracker(): ApplicationTracker { return { progress: {}, mailJobs: [], submissions: {} } }
export async function loadApplicationTracker() { return await get<ApplicationTracker>(KEY) ?? emptyApplicationTracker() }
/** Atomic read/modify/write preserves simultaneous edits, submissions and agent updates. */
export async function updateApplicationTracker(change: (current: ApplicationTracker) => ApplicationTracker) {
  let saved!: ApplicationTracker
  await update<ApplicationTracker>(KEY, current => { saved = change(current ?? emptyApplicationTracker()); return saved })
  return saved
}
export function captureMailSubmissions(batch: MailBatch, descriptions: Record<string, string>, now: number) {
  return Object.fromEntries(batch.jobs.map(job => {
    const value = job.attachment ?? batch.attachment
    const bytes = Uint8Array.from(atob(value.base64), character => character.charCodeAt(0))
    return [job.id, { jobDescription: descriptions[job.id] ?? '', attachment: new File([bytes], value.name), at: now, channel: 'mail' as const }]
  }))
}
