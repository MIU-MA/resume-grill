import { emailSchema, sourceUrlSchema, type CareerPage } from '@/domain/mail-schema'
import { careerUrlKey, parseCareerText } from './pasted-career'
import type { Draft } from './draft-state'

export type ImportedContact = Pick<Draft, 'company' | 'role' | 'recipient' | 'sourceUrl' | 'jobDescription'> & { extraction?: CareerPage }
const HEADERS: Record<string, keyof ImportedContact> = {
  公司: 'company', 公司名称: 'company', 企业: 'company', company: 'company', organization: 'company',
  岗位: 'role', 职位: 'role', 岗位名称: 'role', 职位名称: 'role', role: 'role', position: 'role', jobtitle: 'role',
  邮箱: 'recipient', 招聘邮箱: 'recipient', 收件人: 'recipient', 收件邮箱: 'recipient', email: 'recipient', recipient: 'recipient',
  链接: 'sourceUrl', 来源: 'sourceUrl', 来源链接: 'sourceUrl', 官网链接: 'sourceUrl', 招聘链接: 'sourceUrl', sourceurl: 'sourceUrl', url: 'sourceUrl', link: 'sourceUrl',
  岗位要求: 'jobDescription', 岗位描述: 'jobDescription', 职位描述: 'jobDescription', jobdescription: 'jobDescription', jd: 'jobDescription',
}
const emptyContact = (): ImportedContact => ({ company: '', role: '', recipient: '', sourceUrl: '', jobDescription: '' })
const emails = (text: string) => [...text.matchAll(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi)].map(match => match[0].replace(/[.,;:!?]+$/, ''))
const urls = (text: string) => [...text.matchAll(/https?:\/\/[^\s<>"，；]+/gi)].map(match => match[0].replace(/[。,;）)]+$/, ''))

function columns(input: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < input.length; i++) {
    const character = input[i]
    if (character === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i++ }
      else if (quoted || !cell.trim()) quoted = !quoted
      else cell += character
    } else if (!quoted && character === delimiter) {
      row.push(cell.trim()); cell = ''
    } else if (!quoted && (character === '\r' || character === '\n')) {
      if (character === '\r' && input[i + 1] === '\n') i++
      row.push(cell.trim()); cell = ''
      if (row.some(Boolean)) rows.push(row)
      row = []
    } else cell += character
  }
  if (quoted) throw new Error('CSV 的引号没有闭合，请检查文件内容。')
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

const headerKey = (value: string) => HEADERS[value.replace(/[\s_-]/g, '').toLowerCase()]

function fromLine(value: string): ImportedContact {
  const contact = emptyContact()
  const foundEmails = [...new Set(emails(value))]
  const foundUrls = urls(value)
  contact.recipient = foundEmails.length === 1 ? foundEmails[0] : ''
  contact.sourceUrl = foundUrls[0] ?? ''
  let remaining = value
  for (const token of [...foundEmails, ...foundUrls]) remaining = remaining.replaceAll(token, '')
  const fields = remaining.split(/[\t,，;；|]+/).map(field => field.trim()).filter(Boolean)
  const parts = fields.length >= 2 ? fields : remaining.trim().split(/\s+/).filter(Boolean)
  contact.company = parts[0] ?? ''
  contact.role = parts.slice(1).join(' ')
  if (foundEmails.length > 1) contact.extraction = { url: contact.sourceUrl, title: '', company: contact.company, role: contact.role, emails: foundEmails.map(email => ({ email, context: value.slice(0, 240) })), recommendedEmail: '', notes: ['这一行有多个邮箱，请选择对应岗位的地址。'] }
  return contact
}

function fromBlock(value: string): ImportedContact {
  const contact = emptyContact()
  contact.sourceUrl = urls(value)[0] ?? ''
  const page = parseCareerText(value)
  return { ...contact, company: page.company, role: page.role, recipient: page.recommendedEmail, jobDescription: page.jobDescription ?? '', extraction: { ...page, url: contact.sourceUrl } }
}

// Import is local and deterministic: addresses must be present in the input.
// Missing or malformed fields remain visible in the workbench for correction.
export function parseContactList(raw: string, defaultRole = ''): ImportedContact[] {
  const input = raw.replace(/^\uFEFF/, '').trim()
  if (!input) throw new Error('请粘贴名单或选择 CSV 文件。')
  if (input.length > 120000) throw new Error('内容过长，请分批导入（每批最多 20 个岗位）。')
  if (input.includes('\0') || /<\/?(?:html|script|iframe|body)\b/i.test(input)) throw new Error('请使用招聘文字或 CSV，不要粘贴网页源代码。')
  const firstLine = input.split(/\r?\n/, 1)[0]
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(',') ? ',' : firstLine.includes(';') ? ';' : '，'
  const isRecruitmentText = /^(?:公司(?:名称)?|招聘单位|用人单位|岗位(?:名称)?|职位(?:名称)?|招聘岗位|招聘职位|company|position|job title)\s*[:：]/im.test(input)
  const table = isRecruitmentText ? [] : columns(input, delimiter)
  const headers = table[0]?.map(headerKey) ?? []
  let contacts: ImportedContact[]
  if (headers.includes('recipient')) {
    const supported = headers.filter(Boolean)
    if (new Set(supported).size !== supported.length) throw new Error('CSV 中有重复的公司、岗位或邮箱列，请先合并。')
    contacts = table.slice(1).map(row => {
      const contact = emptyContact()
      headers.forEach((key, index) => { if (key && key !== 'extraction') contact[key] = row[index] ?? '' })
      return contact
    })
  } else if (isRecruitmentText) {
    contacts = input.split(/\r?\n\s*---+\s*\r?\n|(?:\r?\n)+(?=(?:公司(?:名称)?|招聘单位|用人单位|company)\s*[:：])/i).filter(value => value.trim()).map(value => {
      try { return fromBlock(value) }
      catch (cause) { throw new Error(`招聘正文无法整理：${cause instanceof Error ? cause.message : '请检查内容'} 每段请从「公司：」开始，或用 --- 分隔。`) }
    })
  } else if (table.every(row => row.length >= 3)) {
    contacts = table.map(row => ({ company: row[0], role: row[1], recipient: row[2], sourceUrl: row[3] ?? '', jobDescription: row[4] ?? '' }))
  } else {
    contacts = input.split(/\r?\n/).filter(value => value.trim()).map(fromLine)
  }
  if (!contacts.length) throw new Error('名单里没有岗位，请在表头下面添加数据。')
  if (contacts.length > 200) throw new Error('名单过长，请分批导入。')
  return contacts.map(contact => ({ ...contact, recipient: emailSchema.safeParse(contact.recipient).success ? contact.recipient.trim().toLowerCase() : contact.recipient.trim(), role: contact.role.trim() || defaultRole.trim(), company: contact.company.trim(), sourceUrl: contact.sourceUrl.trim(), jobDescription: contact.jobDescription?.trim().slice(0, 12000) ?? '' }))
}

function contactKeys(contact: Pick<ImportedContact, 'recipient' | 'role' | 'sourceUrl'>) {
  const keys: string[] = []
  const role = contact.role.normalize('NFKC').replace(/\s+/g, '').toLowerCase()
  if (emailSchema.safeParse(contact.recipient).success && role) keys.push(`mail:${contact.recipient.toLowerCase()}\n${role}`)
  else if (sourceUrlSchema.safeParse(contact.sourceUrl).success && role) keys.push(`url:${careerUrlKey(contact.sourceUrl)}\n${role}`)
  return keys
}

export async function readContactFile(file: File): Promise<string> {
  if (!file.size || file.size > 512 * 1024) throw new Error('请选择 512 KB 以内的 CSV 或 TSV 文件。')
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { return new TextDecoder('gb18030', { fatal: true }).decode(bytes) }
}

export function planContactImports(contacts: ImportedContact[], existing: Draft[], slots: number) {
  const seen = new Set(existing.flatMap(contactKeys))
  let duplicates = 0
  const items = contacts.filter(contact => {
    const keys = contactKeys(contact)
    if (keys.some(key => seen.has(key))) { duplicates++; return false }
    keys.forEach(key => seen.add(key))
    return true
  })
  if (!items.length) throw new Error('这些岗位已经在清单中，无需重复导入。')
  if (items.length > slots) throw new Error(`这批还能添加 ${Math.max(0, slots)} 个岗位，当前有 ${items.length} 个新条目，请分批导入。`)
  return { items, duplicates }
}
