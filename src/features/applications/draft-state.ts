import { mailDraftSchema, MAX_ATTACHMENT_BYTES, sourceUrlSchema, type CareerPage, type MailDraft } from '@/domain/mail-schema'

export type Draft = Omit<MailDraft, 'sourceConfirmed'> & { sourceConfirmed: boolean; automatic?: boolean; extraction?: CareerPage }
export type DraftField = 'company' | 'role' | 'sourceUrl' | 'recipient' | 'subject' | 'body'
export type WebsiteApplication = Draft & { channel: 'website'; applicationUrl: string; appliedAt: number }

export function draftPayload({ id, company, role, sourceUrl, recipient, subject, body }: Draft) {
  return { id, company, role, sourceUrl, recipient, subject, body, sourceConfirmed: true as const }
}

export function draftIssues(draft: Draft): Array<{ field: DraftField; label: string }> {
  const labels: Record<DraftField, string> = { company: '公司', role: '岗位', sourceUrl: '官网链接', recipient: '招聘邮箱', subject: '邮件主题', body: '邮件正文' }
  const parsed = mailDraftSchema.safeParse(draftPayload(draft))
  if (parsed.success) return []
  const fields = new Set(parsed.error.issues.map(issue => issue.path[0]))
  return (Object.keys(labels) as DraftField[]).filter(field => fields.has(field)).map(field => ({ field, label: `${draft[field].trim() ? '检查' : '缺'}${labels[field]}` }))
}

export function websiteLinks(draft: Draft) {
  if (draft.recipient.trim() || draft.extraction?.url !== draft.sourceUrl) return []
  return (draft.extraction?.links ?? []).filter(link => link.kind === 'apply' && sourceUrlSchema.safeParse(link.url).success)
}

export function validResumeAttachment(file: unknown): file is File {
  return typeof File !== 'undefined' && file instanceof File && file.size > 0 && file.size <= MAX_ATTACHMENT_BYTES && /\.(pdf|docx|txt)$/i.test(file.name)
}

export function markWebsiteApplication(draft: Draft, applicationUrl: string, appliedAt: number): WebsiteApplication {
  if (draftIssues(draft).some(issue => ['company', 'role', 'sourceUrl'].includes(issue.field)) || !websiteLinks(draft).some(link => link.url === applicationUrl)) {
    throw new Error('请补齐公司、岗位，并选择此招聘页中的官网申请链接。')
  }
  return { ...draft, channel: 'website', applicationUrl, appliedAt }
}
