import { sourceUrlSchema, type MailJob } from '@/domain/mail-schema'
import type { Draft, WebsiteApplication } from './draft-state'

export const MAIL_STATUS_TONES = {
  queued: 'info', sending: 'info', sent: 'success', failed: 'danger', uncertain: 'danger', cancelled: 'neutral',
} satisfies Record<MailJob['status'], 'info' | 'success' | 'danger' | 'neutral'>
export function isJob(value: Draft | MailJob | WebsiteApplication): value is MailJob { return 'status' in value }
export function isWebsite(value: Draft | MailJob | WebsiteApplication): value is WebsiteApplication { return 'channel' in value && value.channel === 'website' }
export function savedDate(value: number) { return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }

export function safeLink(value: string) {
  return sourceUrlSchema.safeParse(value).success ? value : undefined
}
