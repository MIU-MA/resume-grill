import { sourceUrlSchema, type MailJob } from '@/domain/mail-schema'

export const MAIL_STATUS_TONES = {
  queued: 'info', sending: 'info', sent: 'success', failed: 'danger', uncertain: 'danger', cancelled: 'neutral',
} satisfies Record<MailJob['status'], 'info' | 'success' | 'danger' | 'neutral'>
export function savedDate(value: number) { return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
export function savedDay(value: number) { return new Date(value).toLocaleDateString('zh-CN') }

export function safeLink(value: string) {
  return sourceUrlSchema.safeParse(value).success ? value : undefined
}
