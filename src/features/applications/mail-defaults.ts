import { z } from 'zod'
import { emailSchema, inferSmtpProvider, type MailSender } from '@/domain/mail-schema'
import type { Draft } from './draft-state'

export const DEFAULT_SUBJECT_TEMPLATE = '应聘{{岗位}}-{{姓名}}'
export const DEFAULT_BODY_TEMPLATE = '您好：\n\n我想应聘{{公司}}的{{岗位}}岗位，附件是我的简历。\n\n感谢您查看，期待有机会进一步沟通。\n\n{{姓名}}'
const VARIABLES: Record<string, 'company' | 'role' | 'name' | 'address'> = {
  公司: 'company', company: 'company', 岗位: 'role', role: 'role', 姓名: 'name', name: 'name', 发件邮箱: 'address', email: 'address',
}
const placeholder = /\{\{\s*([^{}]+?)\s*\}\}/g
const singleLine = (max: number) => z.string().trim().max(max).refine(value => [...value].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127), '请使用单行文字')
const template = (max: number) => z.string().trim().min(1, '请填写模板').max(max).refine(value => !value.includes('\0'), '模板不能包含空字符').superRefine((value, context) => {
  for (const match of value.matchAll(placeholder)) {
    if (!Object.hasOwn(VARIABLES, match[1].trim())) context.addIssue({ code: 'custom', message: `不支持的模板变量：${match[1].trim()}` })
  }
  if (/[{}]/.test(value.replace(placeholder, ''))) context.addIssue({ code: 'custom', message: '模板变量请使用 {{公司}} 这样的双花括号' })
})

export const mailDefaultsSchema = z.object({
  sender: z.object({
    provider: z.enum(['qq', '163']),
    name: singleLine(80),
    address: z.union([z.literal(''), emailSchema]),
  }).strict(),
  role: singleLine(120),
  subject: template(200).refine(value => !/[\r\n\t]/.test(value), '邮件主题不能换行'),
  body: template(12000),
}).strict()
export type MailDefaults = z.infer<typeof mailDefaultsSchema>

export function initialMailDefaults(): MailDefaults {
  return { sender: { provider: 'qq', address: '', name: '' }, role: '', subject: DEFAULT_SUBJECT_TEMPLATE, body: DEFAULT_BODY_TEMPLATE }
}

export function restoreMailDefaults(value: unknown): MailDefaults {
  const parsed = mailDefaultsSchema.safeParse(value)
  return parsed.success ? parsed.data : initialMailDefaults()
}

export function renderMailTemplate(defaults: MailDefaults, draft: Pick<Draft, 'company' | 'role'>, sender?: MailSender | null) {
  const person = sender ?? defaults.sender
  const values = { company: draft.company.trim() || '贵公司', role: draft.role.trim() || '相关', name: person.name.trim(), address: person.address.trim() }
  if (!values.name) return null
  const fill = (value: string) => value.replace(placeholder, (_, key: string) => values[VARIABLES[key.trim()]])
  return { subject: fill(defaults.subject), body: fill(defaults.body) }
}

// Only generated drafts follow settings changes. A user's own text stays intact.
export function applyMailDefaults(drafts: Draft[], defaults: MailDefaults, sender?: MailSender | null): Draft[] {
  let changed = false
  const next = drafts.map(draft => {
    if (!draft.automatic) return draft
    const content = renderMailTemplate(defaults, draft, sender)
    if (!content || (content.subject === draft.subject && content.body === draft.body)) return draft
    changed = true
    return { ...draft, ...content }
  })
  return changed ? next : drafts
}

export function senderDefaults(defaults: MailDefaults, sender: MailSender): MailDefaults {
  return { ...defaults, sender: { name: sender.name, address: sender.address, provider: inferSmtpProvider(sender.address) ?? defaults.sender.provider } }
}
