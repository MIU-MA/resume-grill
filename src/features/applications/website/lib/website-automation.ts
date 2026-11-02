import { get, set } from 'idb-keyval'
import { sourceUrlSchema, type MailSender } from '@/domain/mail-schema'
import { PROFILE_LABELS, profileSchema, websiteBatchSchema, type WebsiteProfile } from '@/domain/website-automation'
import type { Draft } from '../../mail/lib/draft-state'
import { validResumeAttachment } from '../../mail/lib/draft-state'
import { encodeAttachment } from '../../mail/lib/mail-attachment'
import type { WebsiteExperience } from '@/domain/website-experience'
import { requestWebsiteExtension, type ExtensionConnectionOptions } from './website-extension-connection'

const PROFILE_KEY = 'website-autofill:profile:v1'
export async function loadWebsiteProfile() { return profileSchema.parse((await get<WebsiteProfile>(PROFILE_KEY)) ?? {}) }
export function saveWebsiteProfile(profile: WebsiteProfile) {
  const parsed = profileSchema.safeParse(profile)
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || '请检查填写资料。')
  return set(PROFILE_KEY, parsed.data)
}
export function seedWebsiteProfile(text: string, sender?: MailSender | null): WebsiteProfile {
  const profile: WebsiteProfile = { name: sender?.name ?? '', email: sender?.address ?? '' }
  for (const key of Object.keys(PROFILE_LABELS) as Array<keyof WebsiteProfile>) {
    const label = PROFILE_LABELS[key]
    const matches = [...text.matchAll(new RegExp(`(?:^|[\\n|｜])\\s*${label}[：:]\\s*([^\\n|｜]{1,200})`, 'g'))].map(match => match[1].trim())
    if (!profile[key] && new Set(matches).size === 1) profile[key] = matches[0]
  }
  const phones = [...new Set(text.slice(0, 2000).match(/(?<!\d)(?:\+86[- ]?)?1[3-9]\d{9}(?!\d)/g) ?? [])]
  if (!profile.phone && phones.length === 1) profile.phone = phones[0]
  const emails = [...new Set(text.slice(0, 2000).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])]
  if (!profile.email && emails.length === 1) profile.email = emails[0]
  for (const key of Object.keys(profile) as Array<keyof WebsiteProfile>) if (!profileSchema.safeParse({ [key]: profile[key] }).success) delete profile[key]
  return profileSchema.parse(profile)
}
export function websiteTargets(drafts: Draft[]) {
  return drafts.filter(draft => !draft.recipient.trim() && sourceUrlSchema.safeParse(draft.sourceUrl).success && draft.company.trim() && draft.role.trim()).map(draft => {
    const links = draft.extraction?.url === draft.sourceUrl ? (draft.extraction.links ?? []).filter(link => link.kind === 'apply' && sourceUrlSchema.safeParse(link.url).success) : []
    return { draft, links, url: links.length === 1 ? links[0].url : links.length ? '' : draft.sourceUrl }
  })
}
export async function makeWebsiteBatch(drafts: Draft[], urls: Record<string, string>, profile: WebsiteProfile, file: File | null, experiences?: WebsiteExperience[]) {
  if (!validResumeAttachment(file)) throw new Error('请先选择 5 MB 以内的 PDF、DOCX 或 TXT 简历。')
  const targets = websiteTargets(drafts)
  if (!targets.length) throw new Error('先勾选带有官网链接的岗位；有招聘邮箱的条目仍走邮件投递。')
  const jobs = targets.map(({ draft, links, url }) => {
    const selected = urls[draft.id] ?? url
    if (!selected || (links.length && !links.some(link => link.url === selected)) || (!links.length && selected !== draft.sourceUrl)) throw new Error(`请为 ${draft.company} 选择申请入口。`)
    return { id: draft.id, company: draft.company, role: draft.role, url: selected }
  })
  return websiteBatchSchema.parse({ id: crypto.randomUUID(), createdAt: Date.now(), jobs, profile, experiences, attachment: { name: file.name, base64: await encodeAttachment(file) } })
}
export function extensionRequest<T>(type: 'ping' | 'snapshot' | 'stage', batch?: unknown, options?: ExtensionConnectionOptions): Promise<T> {
  return requestWebsiteExtension<T>(type, batch, options)
}
