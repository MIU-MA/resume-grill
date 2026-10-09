import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import ipaddr from 'ipaddr.js'
import { load } from 'cheerio'
import { extractCareerLinks } from './career-links.ts'
import { emailSchema, sourceUrlSchema, type CareerJob, type CareerPage } from '../domain/mail-schema.ts'
import { companyFromCareerUrl } from '../data/career-sites.ts'

const ROLE_PATTERN = /工程师|开发|设计师|产品经理|运营|专员|分析师|研究员|实习生|助理|总监|顾问|销售|会计|engineer|developer|designer|analyst|manager|intern|scientist/i
const DESCRIPTION_SECTION = /^(?:(?:[一二三四五六七八九十\d]+)[、.．）)]\s*)?(?:岗位职责|工作职责|职位职责|职责描述|主要职责|工作内容|任职要求|职位要求|岗位要求|任职资格|应聘要求|技能要求|职责要求|job responsibilities|responsibilities|qualifications|requirements)(?:\s*[:：]|\s*$)/i
const DESCRIPTION_END = /^(?:公司简介|公司介绍|关于我们|薪资待遇|福利待遇|工作地点|投递方式|应聘方式|联系方式|招聘邮箱|申请职位|立即申请|相关职位|推荐职位|about us|benefits|how to apply|apply now|related jobs)(?:\s*[:：]|\s*$)/i
const NON_JOB_HEADING = /职位列表|岗位列表|招聘岗位|招聘职位|加入我们|加入团队|关于我们|热招岗位|careers|vacancies|join our|open positions/i
const MAX_DESCRIPTION_LENGTH = 12000

function descriptionDocument(html: string) {
  const $ = load(html)
  $('script,style,noscript,svg,template,nav,footer,header,aside,form,button,[hidden],[aria-hidden="true"]').remove()
  $('[style]').each((_, element) => {
    if (/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test($(element).attr('style') ?? '')) $(element).remove()
  })
  return $
}

function descriptionLines($: ReturnType<typeof load>) {
  $('br').replaceWith('\n')
  $('p,div,section,article,li,td,h1,h2,h3,h4,h5,h6').append('\n')
  return $('body').text().split(/\n+/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
}

function extractJobDescription(html: string, postings: Array<Record<string, unknown>>, role: string): string | undefined {
  // A list cannot supply a single job's requirements, even if one card is visible.
  if (postings.length > 1) return undefined
  const structured = postings[0]?.description
  if (typeof structured === 'string') {
    const text = descriptionLines(descriptionDocument(structured)).join('\n').trim()
    if (text) return text.slice(0, MAX_DESCRIPTION_LENGTH)
  }
  if (!role || NON_JOB_HEADING.test(role)) return undefined
  const $ = descriptionDocument(html)
  if ($('h1').toArray().some(element => NON_JOB_HEADING.test($(element).text()))) return undefined
  const headings = new Set($('h1,h2,h3,h4,h5,h6').toArray().map(element => $(element).text().replace(/\s+/g, ' ').trim()))
  const jobHeadings = [...headings].filter(heading => heading.length < 80 && ROLE_PATTERN.test(heading) && !DESCRIPTION_SECTION.test(heading) && !NON_JOB_HEADING.test(heading))
  if (new Set(jobHeadings).size > 1) return undefined
  const lines = descriptionLines($)
  if (lines.filter(line => /^(?:岗位名称|职位名称)\s*[:：]/.test(line)).length > 1) return undefined
  const result: string[] = []
  let section: string[] | null = null
  const finish = () => {
    if (section && section.join('\n').replace(DESCRIPTION_SECTION, '').trim()) result.push(...section)
    section = null
  }
  for (const line of lines) {
    if (DESCRIPTION_SECTION.test(line)) {
      finish()
      section = [line]
    } else if (headings.has(line) || DESCRIPTION_END.test(line) || /(?:简历|应聘|投递|招聘邮箱|联系人|send|apply).{0,100}@/i.test(line)) {
      finish()
    } else if (section) {
      section.push(line)
    }
  }
  finish()
  return result.length ? result.join('\n').slice(0, MAX_DESCRIPTION_LENGTH) : undefined
}

export function isPublicAddress(address: string): boolean {
  if (!ipaddr.isValid(address)) return false
  let parsed = ipaddr.parse(address)
  if (parsed.kind() === 'ipv6' && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
    parsed = (parsed as ipaddr.IPv6).toIPv4Address()
  }
  return parsed.range() === 'unicast'
}

export async function resolvePublicHost(hostname: string) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const addresses = await Promise.race([
    lookup(hostname.replace(/^\[|\]$/g, ''), { all: true, verbatim: true }),
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('招聘网站域名解析超时，请稍后再试')), 6000) }),
  ]).finally(() => clearTimeout(timer))
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) {
    throw new Error('招聘页必须使用公网地址，不能访问本机或内网')
  }
  return addresses[0]
}

export function extractCareerEmails(html: string, url: string, includeJobs = true): CareerPage {
  const $ = load(html)
  const postings: Array<Record<string, unknown>> = []
  const visit = (value: unknown, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 12) return
    if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1)); return }
    const item = value as Record<string, unknown>
    if (item['@type'] === 'JobPosting' || (Array.isArray(item['@type']) && item['@type'].includes('JobPosting'))) postings.push(item)
    else Object.values(item).forEach(child => visit(child, depth + 1))
  }
  $('script[type="application/ld+json"]').each((_, el) => {
    try { visit(JSON.parse($(el).text())) } catch { /* Malformed website metadata is not a job. */ }
  })
  $('script,style,noscript,svg,template').remove()
  const title = $('title').first().text().trim().slice(0, 200)
  const candidates = new Map<string, string>()
  const add = (value: string, context: string) => {
    const result = emailSchema.safeParse(value.replace(/[.,;:!?]+$/, ''))
    if (result.success && !candidates.has(result.data) && candidates.size < 50) {
      candidates.set(result.data, context.replace(/\s+/g, ' ').trim().slice(0, 240))
    }
  }
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href') ?? ''
    if (!/^mailto:/i.test(href)) return
    // Ignore mailto subject/body/cc/bcc. A page never supplies sending instructions.
    let addresses = href.slice(7).split('?')[0]
    try { addresses = decodeURIComponent(addresses) } catch { return }
    for (const address of addresses.split(/[;,]/)) add(address.trim(), $(element).parent().text())
  })
  $('br').replaceWith('\n')
  $('p,div,section,footer,header,article,li,td,h1,h2,h3').append('\n')
  const rawText = $('body').text()
  const text = rawText.replace(/\s+/g, ' ')
  for (const match of text.matchAll(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)+/gi)) {
    const index = match.index ?? 0
    add(match[0], text.slice(Math.max(0, index - 70), index + match[0].length + 100))
  }
  const short = (value: unknown) => typeof value === 'string' ? load(value).text().replace(/\s+/g, ' ').trim().slice(0, 120) : ''
  const single = postings.length === 1 ? postings[0] : undefined
  const contacts = Array.isArray(single?.applicationContact) ? single.applicationContact : [single?.applicationContact]
  const contactEmails: string[] = []
  for (const contact of contacts) {
    if (!contact || typeof contact !== 'object') continue
    const value = (contact as Record<string, unknown>).email
    for (const email of Array.isArray(value) ? value : [value]) {
      if (typeof email !== 'string') continue
      const parsed = emailSchema.safeParse(email.replace(/^mailto:/i, '').trim())
      if (parsed.success) { add(parsed.data, '此岗位的招聘联系人'); contactEmails.push(parsed.data) }
    }
  }
  const organization = single?.hiringOrganization as { name?: unknown } | undefined
  const heading = $('h1').length === 1 ? short($('h1').text()) : ''
  const labelledRole = rawText.match(/(?:岗位名称|职位名称)[：:]\s*([^\n。；;]{2,80})/)?.[1]
  const labelledCompany = rawText.match(/(?:公司名称|招聘单位|用人单位)[：:]\s*([^\n。；;]{2,80})/)?.[1]
  const role = postings.length > 1 ? '' : short(single?.title) || short(labelledRole) || (heading.length < 80 && ROLE_PATTERN.test(heading) && !NON_JOB_HEADING.test(heading) ? heading : '')
  const siteName = short($('meta[property="og:site_name"]').attr('content'))
  const company = short(organization?.name) || short($('[itemprop="hiringOrganization"] [itemprop="name"]').first().text()) || short(labelledCompany) || companyFromCareerUrl(url) || (/^(官网|招聘|人才招聘|职位列表|careers?|jobs?)$/i.test(siteName) ? '' : siteName)
  const emails = [...candidates].map(([email, context]) => ({ email, context }))
  const hiring = emails.filter(({ email, context }) => {
    const local = email.split('@')[0]
    if (/support|privacy|legal|service|sales|security|abuse|noreply|webmaster/i.test(local) || /客服|商务合作|隐私|举报|投诉|销售咨询/.test(context)) return false
    return contactEmails.includes(email) || /^(hr|jobs?|careers?|recruit\w*|talent)([._+-]|$)/i.test(local) || /简历|应聘|招聘邮箱|投递|recruit|resume|cv\b|apply|application/i.test(context)
  })
  const explicitContacts = hiring.filter(item => contactEmails.includes(item.email))
  const recommendedEmail = explicitContacts.length === 1 ? explicitContacts[0].email : hiring.length === 1 ? hiring[0].email : ''
  const notes: string[] = []
  if (postings.length > 1) notes.push('页面包含多个岗位，请使用具体岗位详情链接或补充要投的岗位。')
  if (!company) notes.push('未识别到公司名称。')
  if (!role) notes.push('未识别到单一岗位名称。')
  if (!recommendedEmail) notes.push(hiring.length > 1 ? '发现多个可能的招聘邮箱，请选择对应岗位的地址。' : '未识别到明确的招聘邮箱，请核对官网。')
  const subjectRequirement = rawText.match(/(?:邮件主题|邮件标题)[^\n]{0,180}/)?.[0]
  if (subjectRequirement) notes.push(`官网说明：${subjectRequirement}`)
  const jobDescription = extractJobDescription(html, postings, role)
  const jobs = includeJobs ? extractPageJobs(html, url, postings) : []
  // A listing's first title must not become the user's chosen job.
  const isListing = jobs.length > 1
  if (isListing && !notes.some(note => note.includes('多个岗位'))) notes.push('页面包含多个岗位，选择后会带入对应的职责、要求和邮箱。')
  const resolvedRole = isListing ? '' : role || jobs[0]?.role || ''
  return { url, title, emails, company, role: resolvedRole, recommendedEmail, notes: notes.filter(note => !resolvedRole || !note.includes('未识别到单一岗位名称')),
    links: extractCareerLinks(html, url),
    ...(!isListing && (jobDescription || jobs[0]?.jobDescription) ? { jobDescription: jobDescription || jobs[0]?.jobDescription } : {}),
    ...(jobs.length ? { jobs } : {}),
  }
}

function extractPageJobs(html: string, url: string, postings: Array<Record<string, unknown>>): CareerJob[] {
  const jobs: CareerJob[] = []
  const add = (content: string) => {
    if (jobs.length >= 30) return
    const page = extractCareerEmails(content, url, false)
    if (!page.role) return
    jobs.push({ id: `job-${jobs.length + 1}`, role: page.role, company: page.company || undefined,
      emails: page.emails, recommendedEmail: page.recommendedEmail, emailAmbiguous: page.notes.some(note => note.includes('多个可能的招聘邮箱')), jobDescription: page.jobDescription })
  }
  if (postings.length) {
    for (const posting of postings) {
      add(`<script type="application/ld+json">${JSON.stringify(posting).replace(/</g, '\\u003c')}</script>`)
    }
    return jobs
  }
  const $ = load(html)
  $('script,style,noscript,svg,template,nav,footer,header,aside').remove()
  const headings = $('h1,h2,h3,h4,h5,h6,[role="heading"],[role="tab"],[class*="roleTitle"],[class*="job-title"],[class*="jobTitle"],[class*="position-title"]').toArray().filter(element => {
    const text = $(element).text().replace(/\s+/g, ' ').trim()
    return text.length > 1 && text.length < 90 && ROLE_PATTERN.test(text) && !NON_JOB_HEADING.test(text)
      && !DESCRIPTION_SECTION.test(text) && !/^[负责熟悉掌握]|[。；：:]/.test(text)
  })
  const hasRequirements = (content: string) => {
    const doc = load(content)
    return doc('h1,h2,h3,h4,h5,h6,p,div,strong').toArray().some(element => DESCRIPTION_SECTION.test(doc(element).text().trim()))
  }
  for (const heading of headings) {
    if (jobs.length >= 30) break
    const title = $(heading).clone().attr('role', 'heading')
    const metadata = `<script type="application/ld+json">${JSON.stringify({ '@type': 'JobPosting', title: $(heading).text().replace(/\s+/g, ' ').trim() }).replace(/</g, '\\u003c')}</script>`
    // Tabs often keep each job's full requirements in an initially hidden panel.
    const panelId = $(heading).attr('aria-controls')
    if (panelId) {
      let panel = $('[id]').filter((_, element) => $(element).attr('id') === panelId).first().clone()
      if (!panel.length && $(heading).attr('role') === 'tab') {
        // Some server-rendered tab libraries emit inconsistent IDs. Use DOM order
        // only within one tab group with an equal number of tabs and panels.
        let group = $(heading).parent()
        for (let depth = 0; depth < 5 && group.length && !group.is('body,html'); depth++, group = group.parent()) {
          const tabs = group.find('[role="tab"]')
          const panels = group.find('[role="tabpanel"]')
          if (panels.length) {
            if (tabs.length === panels.length && tabs.toArray().every(tab => headings.includes(tab))) panel = panels.eq(tabs.index(heading)).clone()
            break
          }
        }
      }
      if (panel.length && hasRequirements(panel.html() ?? '')) {
        panel.removeAttr('hidden').removeAttr('aria-hidden').removeAttr('style')
        add(`${metadata}${panel.toString()}`)
        continue
      }
      if ($(heading).attr('role') === 'tab') continue
    }
    if ($(heading).attr('role') === 'tab') continue
    let scope = $(heading).parent()
    let content = ''
    for (let depth = 0; depth < 10 && scope.length && !scope.is('body,html'); depth++, scope = scope.parent()) {
      if (headings.filter(other => scope.is(other) || scope.find(other).length).length > 1) break
      if (hasRequirements(scope.html() ?? '')) content = scope.toString()
    }
    if (!content) {
      let siblings = $(heading).next()
      content = title.toString()
      while (siblings.length && !headings.some(other => siblings.is(other) || siblings.find(other).length)) {
        content += siblings.toString()
        siblings = siblings.next()
      }
    }
    if (hasRequirements(content) || $(heading).is('[class*="roleTitle"],[class*="job-title"],[class*="jobTitle"],[class*="position-title"]')) add(`${metadata}${content}`)
  }
  return jobs
}

const MAX_PAGE_BYTES = 2 * 1024 * 1024
export async function readCareerPage(input: string, redirects = 0, deadline = Date.now() + 20000, allowUrl?: (url: string) => boolean): Promise<CareerPage> {
  const parsed = sourceUrlSchema.safeParse(input)
  if (!parsed.success) throw new Error('请填写官网招聘页面的 HTTPS 地址（443 端口）')
  if (redirects > 4) throw new Error('招聘页面跳转次数过多，请复制最终页面地址')
  const url = new URL(parsed.data)
  if (allowUrl && !allowUrl(url.href)) throw new Error('链接跳转到其他网站，请从原站入口打开或复制最终地址重新查找')
  const address = await resolvePublicHost(url.hostname)
  if (Date.now() >= deadline) throw new Error('读取招聘页超时，请手动填写邮箱')
  const result = await new Promise<{ redirect?: string; html?: string }>((resolve, reject) => {
    // Pin the validated DNS result; validate every redirect separately.
    const req = request(url, {
      agent: false,
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      family: address.family,
      headers: { 'User-Agent': 'ResumeGrill-CareerReader/1.0', Accept: 'text/html', 'Accept-Encoding': 'identity' },
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode ?? 0)) {
        res.resume()
        if (!res.headers.location) return reject(new Error('招聘页面跳转地址为空'))
        resolve({ redirect: new URL(res.headers.location, url).href })
        return
      }
      if (res.statusCode !== 200) {
        res.resume()
        reject(new Error(`招聘页返回 HTTP ${res.statusCode}，可在浏览器中查看后手动填写邮箱`))
        return
      }
      const type = res.headers['content-type'] ?? ''
      if (!/text\/html|application\/xhtml\+xml/i.test(type) || (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')) {
        res.resume()
        reject(new Error('该地址不是可读取的网页，请使用官网招聘详情页'))
        return
      }
      const chunks: Buffer[] = []
      let size = 0
      res.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_PAGE_BYTES) { req.destroy(new Error('招聘页面超过 2 MB，请手动填写邮箱')); return }
        chunks.push(chunk)
      })
      res.on('error', reject)
      res.on('end', () => {
        const charset = /charset\s*=\s*["']?([^\s;"']+)/i.exec(type)?.[1] ?? 'utf-8'
        try { resolve({ html: new TextDecoder(charset).decode(Buffer.concat(chunks)) }) }
        catch { reject(new Error('招聘页编码无法读取，请手动填写邮箱')) }
      })
    })
    const timeout = setTimeout(() => req.destroy(new Error('读取招聘页超时，请手动填写邮箱')), Math.min(15000, deadline - Date.now()))
    req.once('close', () => clearTimeout(timeout))
    req.once('error', reject)
    req.end()
  })
  if (result.redirect) return readCareerPage(result.redirect, redirects + 1, deadline, allowUrl)
  return extractCareerEmails(result.html ?? '', url.href)
}
