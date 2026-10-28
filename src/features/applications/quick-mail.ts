import { emailSchema, type MailSender } from '@/domain/mail-schema'
import type { Draft } from './draft-state'
import { applyMailDefaults, type MailDefaults } from './mail-defaults'

export function prepareQuickMail(address: string, drafts: Draft[], defaults: MailDefaults, sender?: MailSender | null, jobDescription = '') {
  const recipient = emailSchema.parse(address.trim())
  const jd = jobDescription.trim()
  const existing = drafts.find(item => item.recipient.toLowerCase() === recipient && !item.sourceUrl && (jd ? item.jobDescription?.trim() === jd : !item.company && !item.role && !item.jobDescription?.trim()))
  if (!existing && drafts.length >= 20) throw new Error('清单已满，请先发送或移除一些草稿。')
  const draft = applyMailDefaults([existing ?? {
    id: crypto.randomUUID(), company: '', role: '', sourceUrl: '', recipient,
    subject: '', body: '', sourceConfirmed: false, automatic: true, jobDescription: jd,
  }], defaults, sender)[0]
  return { draft, drafts: existing ? drafts.map(item => item.id === existing.id ? draft : item) : [...drafts, draft] }
}
