import { z } from 'zod'

export const MAIL_AGENT_URL = 'http://127.0.0.1:4318'
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
export const SMTP_PRESETS = {
  qq: { label: 'QQ 邮箱', host: 'smtp.qq.com', domains: ['qq.com', 'foxmail.com'] },
  '163': { label: '163 邮箱', host: 'smtp.163.com', domains: ['163.com'] },
} as const

const line = (max: number) => z.string().trim().min(1).max(max).refine(value => [...value].every(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127), '不能包含换行或控制字符')
export const emailSchema = z.email().max(254).transform(value => value.toLowerCase())
export const sourceUrlSchema = z.url().max(2048).refine(value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443')
  } catch { return false }
}, '请填写官网招聘页面的 HTTPS 地址')

export const smtpConfigSchema = z.object({
  provider: z.enum(['qq', '163']),
  address: emailSchema,
  name: line(80),
  authorizationCode: line(256),
}).strict().refine(value => {
  const domains: readonly string[] = SMTP_PRESETS[value.provider].domains
  return domains.includes(value.address.split('@')[1])
}, '邮箱地址与所选邮箱类型不一致')
export type SmtpConfig = z.infer<typeof smtpConfigSchema>
export type MailSender = Pick<SmtpConfig, 'address' | 'name'>

export const mailDraftSchema = z.object({
  id: z.uuid(),
  company: line(120),
  role: line(120),
  sourceUrl: sourceUrlSchema,
  recipient: emailSchema,
  subject: line(200),
  body: z.string().trim().min(1).max(12000).refine(value => !value.includes('\0')),
  sourceConfirmed: z.literal(true),
}).strict()
export type MailDraft = z.infer<typeof mailDraftSchema>

export const attachmentSchema = z.object({
  name: line(180).refine(value => !/[\\/]/.test(value) && /\.(pdf|docx|txt)$/i.test(value), '附件支持 PDF、DOCX、TXT'),
  base64: z.string().min(4).max(Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/).refine(value => value.length % 4 === 0),
}).strict()
export type MailAttachment = z.infer<typeof attachmentSchema>
export const batchSchema = z.object({
  id: z.uuid(),
  sender: z.object({ address: emailSchema, name: line(80) }).strict(),
  jobs: z.array(mailDraftSchema).min(1).max(20),
  attachment: attachmentSchema,
}).strict()
export type MailBatch = z.infer<typeof batchSchema>

export type MailStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'uncertain' | 'cancelled'
export const MAIL_STATUS_LABELS: Record<MailStatus, string> = {
  queued: '待发送', sending: '发送中', sent: '已提交邮箱', failed: '发送失败', uncertain: '待核对', cancelled: '已取消',
}
export type MailJob = MailDraft & {
  batchId: string
  sender: MailSender
  status: MailStatus
  messageId: string
  attachment: { hash: string; name: string; size: number }
  createdAt: number
  updatedAt: number
  detail?: string
}
export type AgentSnapshot = {
  version: 1
  running: boolean
  paused: boolean
  sender: MailSender | null
  jobs: MailJob[]
  fatalError?: string
}
export type EmailCandidate = { email: string; context: string }
export type CareerLink = { url: string; label: string; kind: 'entry' | 'job' | 'apply'; sourceUrl: string }
export type CareerDiscovery = { links: CareerLink[]; pagesRead: number; notes: string[] }
export type CareerPage = { url: string; title: string; emails: EmailCandidate[]; company: string; role: string; recommendedEmail: string; notes: string[]; links?: CareerLink[] }

export function applicationTemplate(name: string, company: string, role: string) {
  return {
    subject: `应聘${role || '岗位名称'}-${name || '姓名'}`,
    body: `您好：\n\n我想应聘${company || '贵公司'}的${role || '岗位名称'}岗位，附件是我的简历。\n\n感谢您查看，期待有机会进一步沟通。\n\n${name || '姓名'}`,
  }
}
