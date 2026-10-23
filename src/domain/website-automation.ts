import { z } from 'zod'
import { attachmentSchema, sourceUrlSchema } from './mail-schema'

export const PROFILE_LABELS = { name: '姓名', email: '邮箱', phone: '手机号', city: '所在城市', school: '学校', major: '专业', degree: '最高学历', educationStart: '入学时间', educationEnd: '毕业时间', company: '最近任职公司', jobTitle: '最近职位', workStart: '入职时间', workEnd: '离职时间', github: 'GitHub', portfolio: '作品集' } as const
export type ProfileKey = keyof typeof PROFILE_LABELS
export const profileSchema = z.partialRecord(z.enum(Object.keys(PROFILE_LABELS) as [ProfileKey, ...ProfileKey[]]), z.string().trim().max(200)).superRefine((profile, ctx) => {
  if (profile.email && !z.email().safeParse(profile.email).success) ctx.addIssue({ code: 'custom', path: ['email'], message: '请检查个人邮箱格式。' })
  if (profile.phone && !/^\+?[\d ()-]{7,25}$/.test(profile.phone)) ctx.addIssue({ code: 'custom', path: ['phone'], message: '请检查手机号或联系电话。' })
  for (const key of ['github', 'portfolio'] as const) if (profile[key] && !sourceUrlSchema.safeParse(profile[key]).success) ctx.addIssue({ code: 'custom', path: [key], message: '个人链接请使用完整的 HTTPS 地址。' })
})
export type WebsiteProfile = z.infer<typeof profileSchema>
export const answerSchema = z.object({ origin: z.url().refine(value => { const url = new URL(value); return url.protocol === 'https:' && url.origin === value }, '答案必须绑定申请网站'), scope: z.string().min(1).max(300), label: z.string().trim().min(1).max(200), value: z.string().trim().min(1).max(2000) }).strict()
export type WebsiteAnswer = z.infer<typeof answerSchema>
export const websiteBatchSchema = z.object({
  id: z.uuid(), createdAt: z.number(), profile: profileSchema,
  jobs: z.array(z.object({ id: z.uuid(), company: z.string().trim().min(1).max(120), role: z.string().trim().min(1).max(120), url: sourceUrlSchema }).strict()).min(1).max(20),
  attachment: attachmentSchema,
}).strict().superRefine((batch, ctx) => {
  if (new Set(batch.jobs.map(job => job.id)).size !== batch.jobs.length) ctx.addIssue({ code: 'custom', message: '岗位重复' })
})
export type WebsiteBatch = z.infer<typeof websiteBatchSchema>
export type MissingField = { key?: ProfileKey; label: string; kind: 'profile' | 'answer' | 'manual' | 'upload' }
export type FormResult = { filled: string[]; uploaded: boolean; missing: MissingField[]; message: string }
export type WebsiteJob = WebsiteBatch['jobs'][number] & {
  status: 'pending' | 'opening' | 'filling' | 'waiting' | 'ready' | 'done' | 'skipped'
  tabId?: number; attempt?: string; result?: FormResult; detail?: string; authorizedOrigins?: string[]
}
export type WebsiteQueue = Omit<WebsiteBatch, 'jobs'> & { jobs: WebsiteJob[]; running: boolean; updatedAt: number; answers: WebsiteAnswer[] }
export type WebsiteSnapshot = Omit<WebsiteQueue, 'attachment'> & { attachmentName: string }
export function publicWebsiteQueue(queue: WebsiteQueue | null): WebsiteSnapshot | null {
  if (!queue) return null
  const { attachment, ...rest } = queue
  return { ...rest, attachmentName: attachment.name }
}
export function isWorkbenchUrl(value: string) {
  try { const url = new URL(value); return url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && ['3000', '3107'].includes(url.port) && ['/', '/applications'].includes(url.pathname) }
  catch { return false }
}
export function normalizeFieldLabel(value: string) { return value.toLowerCase().replace(/[\s*：:()（）_-]/g, '').slice(0, 200) }
export function sensitiveField(value: string) {
  return /密码|验证码|短信码|动态码|身份证|证件号|银行|薪资|薪酬|工资|性别|民族|政治|婚姻|出生|健康|残疾|推荐人|紧急联系人|password|captcha|verification|one.?time|otp|ssn|passport|salary|gender|birth|disability|ethnic|referee|emergency/i.test(value)
}
