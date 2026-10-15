import type { CareerPage, MailSender } from '@/domain/mail-schema'
import type { Draft } from './draft-state'
import { applyMailDefaults, type MailDefaults } from './mail-defaults'
import { careerUrlKey } from './pasted-career'

export function prepareAssistantDrafts(pages: CareerPage[], existing: Draft[], defaults: MailDefaults, sender?: MailSender | null) {
  const key = (url: string, role: string) => {
    let normalized = url
    try { normalized = url ? careerUrlKey(url) : '' } catch { /* Keep unfinished manual links editable. */ }
    return `${normalized}\n${role.trim()}`
  }
  const seen = new Set(existing.map(draft => key(draft.sourceUrl, draft.role)))
  const additions: Draft[] = []
  for (const page of pages) {
    const identity = key(page.url, page.role)
    if (seen.has(identity)) continue
    seen.add(identity)
    additions.push({ id: crypto.randomUUID(), company: page.company, role: page.role,
      sourceUrl: page.url, recipient: page.recommendedEmail, subject: '', body: '', sourceConfirmed: false,
      automatic: true, extraction: page, jobDescription: page.jobDescription ?? '' })
  }
  if (existing.length + additions.length > 20) throw new Error(`清单还能添加 ${Math.max(0, 20 - existing.length)} 个岗位，请减少勾选数量。`)
  return applyMailDefaults(additions, defaults, sender)
}
