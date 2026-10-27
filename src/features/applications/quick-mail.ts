import { emailSchema, type MailSender } from '@/domain/mail-schema'
import type { Draft } from './draft-state'
import { applyMailDefaults, type MailDefaults } from './mail-defaults'

export function prepareQuickMail(address: string, drafts: Draft[], defaults: MailDefaults, sender?: MailSender | null) {
  const recipient = emailSchema.parse(address.trim())
  const existing = drafts.find(item => item.recipient.toLowerCase() === recipient && !item.company && !item.role && !item.sourceUrl)
  if (!existing && drafts.length >= 20) throw new Error('清单已满，请先发送或移除一些草稿。')
  const draft = applyMailDefaults([existing ?? {
    id: crypto.randomUUID(), company: '', role: '', sourceUrl: '', recipient,
    subject: '', body: '', sourceConfirmed: false, automatic: true,
  }], defaults, sender)[0]
  return { draft, drafts: existing ? drafts.map(item => item.id === existing.id ? draft : item) : [...drafts, draft] }
}
