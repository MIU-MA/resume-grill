import { mailDraftSchema, MAX_ATTACHMENT_BYTES, sourceUrlSchema, type CareerPage, type MailDraft } from '@/domain/mail-schema'
import { selectCareerJob } from './career-selection'

export type Draft = Omit<MailDraft, 'sourceConfirmed'> & { sourceConfirmed: boolean; automatic?: boolean; extraction?: CareerPage; jobDescription?: string; jobDescriptionEdited?: boolean }
export type DraftField = 'company' | 'role' | 'sourceUrl' | 'recipient' | 'subject' | 'body'
export type WebsiteApplication = Draft & { channel: 'website'; applicationUrl: string; appliedAt: number }
export type SavedJobPreparation = {
  jobDescription: string
  attachment?: File
  attachmentSource?: { id: string; updatedAt: number }
  attachmentUse?: 'preparation' | 'preview' | 'mail'
}

export function preparationAttachment(saved: SavedJobPreparation | undefined, current: File | null, currentSource?: { id: string; updatedAt: number }) {
  if (validResumeAttachment(saved?.attachment)) return { file: saved.attachment, source: saved.attachmentSource, use: saved.attachmentUse ?? 'preparation' as const, saved: true }
  return { file: validResumeAttachment(current) ? current : null, source: currentSource, use: 'preparation' as const, saved: false }
}

export function updateDraft(draft: Draft, change: Partial<Draft>): Draft {
  const sourceChanged = change.sourceUrl !== undefined && change.sourceUrl !== draft.sourceUrl
  return {
    ...draft, ...change,
    ...(('body' in change || 'subject' in change) ? { automatic: change.automatic === true } : {}),
    ...(('recipient' in change || 'sourceUrl' in change) ? { sourceConfirmed: false } : {}),
    ...('jobDescription' in change ? { jobDescriptionEdited: true } : {}),
    ...(sourceChanged ? { extraction: undefined, jobDescription: '', jobDescriptionEdited: false } : {}),
  }
}

export function applyCareerPage(draft: Draft, page: CareerPage): Draft {
  const matches = page.jobs?.filter(job => job.role === draft.role) ?? []
  if (!page.role && matches.length === 1) page = selectCareerJob(page, matches[0].id)
  const edited = draft.jobDescriptionEdited || (!!draft.jobDescription && draft.jobDescription !== draft.extraction?.jobDescription)
  return {
    ...draft, sourceUrl: page.url, company: draft.company || page.company || '', role: draft.role || page.role || '',
    recipient: draft.recipient || page.recommendedEmail || '', extraction: page,
    jobDescription: edited ? draft.jobDescription : page.jobDescription ?? '',
    automatic: !draft.body && !draft.subject ? true : draft.automatic, sourceConfirmed: false,
  }
}

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

export function selectedMailDrafts(drafts: Draft[], selectedIds: string[]) {
  const selected = new Set(selectedIds)
  return drafts.filter(draft => selected.has(draft.id) && mailDraftSchema.safeParse(draftPayload(draft)).success)
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
