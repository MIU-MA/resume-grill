import { emailSchema, sourceUrlSchema, type CareerPage } from '@/domain/mail-schema'
import { applyCareerPage, type Draft } from './draft-state'

const MAX_TEXT = 24000
const SECTION = /^(?:岗位职责|工作职责|职位职责|工作内容|岗位要求|任职要求|任职资格|职位要求|职责描述|资格要求|job description|responsibilities|requirements|qualifications)\s*[:：]?\s*/i
const SECTION_END = /^(?:公司介绍|关于我们|薪资待遇|福利待遇|工作地点|联系方式|投递方式|招聘邮箱|申请方式|其他岗位|推荐职位|about us|benefits|how to apply)\s*[:：]?/i
const ROLE = /(?:工程师|开发(?:人员)?|设计师|经理|专员|实习生|架构师|研究员|产品运营|engineer|developer|designer|manager|intern|architect)(?:[（(][^()（）]{1,24}[)）])?$/i
const COMPANY_LABEL = /^(?:公司名称|招聘单位|用人单位|公司|company|hiring organization)\s*[:：]\s*(.+)$/i
const ROLE_LABEL = /^(?:岗位名称|职位名称|招聘岗位|招聘职位|岗位|职位|job title|position)\s*[:：]\s*(.+)$/i

export type CareerFailure = { url: string; message: string }

function careerSourceUrl(value: string) {
  const parsed = sourceUrlSchema.safeParse(value)
  if (!parsed.success) throw new Error('请先填写完整的 HTTPS 招聘详情链接。')
  return new URL(parsed.data)
}

export function careerUrlKey(value: string) {
  const url = careerSourceUrl(value)
  // Hash routes can identify different jobs; only ordinary section anchors are ignored.
  if (!/^#[!/]/.test(url.hash) && !/[?=/]/.test(url.hash)) url.hash = ''
  return url.href
}

export function planCareerImports(values: string[], existingUrls: string[], slots: number) {
  const seen = new Set(existingUrls.filter(value => sourceUrlSchema.safeParse(value).success).map(careerUrlKey))
  const urls = values.map(value => careerSourceUrl(value).href).filter(url => {
    const key = careerUrlKey(url)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (!urls.length) throw new Error('这些链接已经在清单中，无需重复导入。')
  if (urls.length > slots) throw new Error(`这批还能添加 ${Math.max(0, slots)} 个岗位，请减少链接数量。`)
  return urls
}

export function settleCareerFailure(failures: CareerFailure[], url: string, message?: string) {
  const key = careerUrlKey(url)
  const remaining = failures.filter(item => careerUrlKey(item.url) !== key)
  return message ? [...remaining, { url: careerSourceUrl(url).href, message }] : remaining
}

// Clipboard text is untrusted content. Parse only visible text; never execute HTML,
// request a URL, or turn instructions in the text into actions.
export function parsePastedCareer(sourceUrl: string, input: string): CareerPage {
  const url = careerSourceUrl(sourceUrl).href
  return { url, ...parseCareerText(input) }
}

export function parseCareerText(input: string): Omit<CareerPage, 'url'> {
  if (!input.trim()) throw new Error('请粘贴这个岗位的招聘正文。')
  if (input.length > MAX_TEXT) throw new Error('正文过长，请只保留一个岗位的内容（不超过 24000 字）。')
  if (/<\/?(?:html|script|body|div|p|iframe|style)\b[^>]*>/i.test(input)) throw new Error('请粘贴网页中可见的招聘文字，不要粘贴网页源代码。')
  // eslint-disable-next-line no-control-regex -- Strip clipboard control characters while keeping tabs and line breaks.
  const lines = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').split(/\r\n?|\n/).map(line => line.trim()).filter(Boolean)
  const companies = [...new Set(lines.map(line => line.match(COMPANY_LABEL)?.[1]?.trim()).filter((value): value is string => !!value && value.length <= 120))]
  const labelledRoles = lines.map(line => line.match(ROLE_LABEL)?.[1]?.trim()).filter((value): value is string => !!value && value.length <= 120)
  const headings = lines.filter(line => line.length <= 55 && ROLE.test(line) && !ROLE_LABEL.test(line) && !SECTION.test(line) && !/^(?:[\d•·\-*]|负责|熟悉|掌握|具备|具有|要求|协助|参与|了解|寻找|招聘|任职|职位|岗位)/.test(line) && !/[，。；:：]/.test(line))
  const roles = [...new Set([...labelledRoles, ...headings])]
  const sectionNames = lines.map(line => line.match(SECTION)?.[0]?.replace(/[：:\s]/g, '').toLowerCase()).filter(Boolean)
  if (roles.length > 1 || companies.length > 1 || sectionNames.some((name, index) => sectionNames.indexOf(name) !== index) || labelledRoles.length > 1) {
    throw new Error('正文包含多个岗位，请只粘贴准备投递的那个职位。')
  }
  const role = roles[0] ?? ''
  const company = companies[0] ?? ''
  const emails = new Map<string, string>()
  for (const line of lines) {
    for (const match of line.matchAll(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi)) {
      const parsed = emailSchema.safeParse(match[0].replace(/[.,;:!?]+$/, ''))
      if (parsed.success && emails.size < 50) emails.set(parsed.data, line.slice(0, 240))
    }
  }
  const candidates = [...emails].map(([email, context]) => ({ email, context }))
  const hiring = candidates.filter(({ email, context }) => {
    const local = email.split('@')[0]
    if (/support|privacy|legal|service|sales|security|abuse|noreply|webmaster/i.test(local) || /客服|商务合作|隐私|举报|投诉|销售咨询/.test(context)) return false
    return /^(hr|jobs?|careers?|recruit\w*|talent)([._+-]|$)/i.test(local) || /简历|应聘|招聘邮箱|投递|recruit|resume|\bcv\b|apply|application/i.test(context)
  })
  const description: string[] = []
  let inSection = false
  for (const line of lines) {
    if (SECTION.test(line)) inSection = true
    else if (SECTION_END.test(line) || COMPANY_LABEL.test(line) || ROLE_LABEL.test(line) || /@|https?:\/\//i.test(line)) inSection = false
    if (inSection) description.push(line)
  }
  const notes = ['由粘贴的招聘正文整理，请核对来源和投递信息。']
  if (!company) notes.push('未找到明确的公司名称，请在右侧补充。')
  if (!role) notes.push('未找到明确的岗位名称，请在右侧补充。')
  if (hiring.length !== 1) notes.push(hiring.length ? '正文包含多个招聘邮箱，请选择对应岗位的地址。' : '未找到明确的招聘邮箱，请核对官网。')
  // Preserve explicit requirements even when the copied selection omitted its
  // job title. A known draft can supply that title without another copy/paste.
  const hasBody = description.some(line => line.replace(SECTION, '').trim())
  const jobDescription = hasBody ? description.join('\n').slice(0, 12000) : ''
  if (!jobDescription) notes.push('未找到明确的职责或任职要求，可在岗位要求中补充。')
  return { title: [company, role].filter(Boolean).join(' / '), company, role, emails: candidates, recommendedEmail: hiring.length === 1 ? hiring[0].email : '', notes, ...(jobDescription ? { jobDescription } : {}) }
}

export function supplementCareerDraft(draft: Draft, page: CareerPage): Draft {
  if (careerUrlKey(draft.sourceUrl) !== careerUrlKey(page.url)) return draft
  const previous = draft.extraction?.url === draft.sourceUrl ? draft.extraction : undefined
  const merged: CareerPage = {
    ...page, url: draft.sourceUrl,
    emails: [...new Map([...(previous?.emails ?? []), ...page.emails].map(item => [item.email, item])).values()],
    links: previous?.links,
    notes: [...new Set([...(previous?.notes ?? []), ...page.notes])],
    jobDescription: draft.jobDescription || previous?.jobDescription || page.jobDescription,
  }
  return applyCareerPage(draft, merged)
}
