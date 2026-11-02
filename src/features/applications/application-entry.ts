import { APPLICATION_CHANNELS, type ManualApplication } from '@/domain/application-record'
import { applicationStage, type ApplicationProgress, type ApplicationStage } from '@/domain/application-progress'
import type { MailJob } from '@/domain/mail-schema'
import type { WebsiteApplication } from './draft-state'

export type ApplicationKind = 'mail' | 'website' | 'manual'
export type ApplicationEntry = {
  id: string
  kind: ApplicationKind
  company: string
  role: string
  contact: string
  sourceUrl: string
  appliedAt: number
  updatedAt: number
  mail?: MailJob
  website?: WebsiteApplication
  manual?: ManualApplication
}

export function buildApplicationEntries({ jobs = [], websites = [], manuals = [], hiddenJobIds = [] }: {
  jobs?: MailJob[]
  websites?: WebsiteApplication[]
  manuals?: ManualApplication[]
  hiddenJobIds?: string[]
}): ApplicationEntry[] {
  const hidden = new Set(hiddenJobIds)
  const entries: ApplicationEntry[] = [
    ...jobs.filter(job => !hidden.has(job.id)).map(job => ({
      id: job.id,
      kind: 'mail' as const,
      company: job.company || job.recipient,
      role: job.role,
      contact: job.recipient,
      sourceUrl: job.sourceUrl,
      appliedAt: job.createdAt,
      updatedAt: job.updatedAt,
      mail: job,
    })),
    ...websites.map(record => ({
      id: record.id,
      kind: 'website' as const,
      company: record.company || record.recipient,
      role: record.role,
      contact: record.recipient,
      sourceUrl: record.sourceUrl || record.applicationUrl,
      appliedAt: record.appliedAt,
      updatedAt: record.appliedAt,
      website: record,
    })),
    ...manuals.map(record => ({
      id: record.id,
      kind: 'manual' as const,
      company: record.company,
      role: record.role,
      contact: record.contact,
      sourceUrl: record.sourceUrl,
      appliedAt: record.appliedAt,
      updatedAt: record.updatedAt,
      manual: record,
    })),
  ]
  return entries.sort((a, b) => b.updatedAt - a.updatedAt || a.company.localeCompare(b.company, 'zh-CN'))
}

export function applicationEntryStage(entry: ApplicationEntry, progress?: ApplicationProgress): ApplicationStage | undefined {
  if (entry.kind === 'mail' && entry.mail) return applicationStage(progress, entry.mail.status)
  return progress?.stage ?? 'awaiting'
}

export function applicationEntryChannel(entry: ApplicationEntry) {
  if (entry.kind === 'mail') return '邮件投递'
  if (entry.kind === 'website') return '官网投递'
  return APPLICATION_CHANNELS[entry.manual?.channel ?? 'other']
}

export function applicationEntryTitle(entry: ApplicationEntry) {
  return [entry.company, entry.role].filter(Boolean).join(' / ') || entry.contact || '未命名投递'
}

export function applicationEntrySearchText(entry: ApplicationEntry) {
  return [entry.company, entry.role, entry.contact, entry.sourceUrl, applicationEntryChannel(entry)].join(' ').toLowerCase()
}
