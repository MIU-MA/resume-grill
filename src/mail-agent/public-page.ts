import { lookup } from 'node:dns/promises'
import { request } from 'node:https'
import ipaddr from 'ipaddr.js'
import { load } from 'cheerio'
import { emailSchema, sourceUrlSchema, type CareerPage } from '../domain/mail-schema.ts'

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

export function extractCareerEmails(html: string, url: string): CareerPage {
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
  const organization = single?.hiringOrganization as { name?: unknown } | undefined
  const heading = $('h1').length === 1 ? short($('h1').text()) : ''
  const rolePattern = /工程师|开发|设计师|产品经理|运营|专员|分析师|研究员|实习生|助理|总监|顾问|销售|会计|engineer|developer|designer|analyst|manager|intern|scientist/i
  const labelledRole = rawText.match(/(?:岗位名称|职位名称)[：:]\s*([^\n。；;]{2,80})/)?.[1]
  const labelledCompany = rawText.match(/(?:公司名称|招聘单位|用人单位)[：:]\s*([^\n。；;]{2,80})/)?.[1]
  const role = postings.length > 1 ? '' : short(single?.title) || short(labelledRole) || (heading.length < 80 && rolePattern.test(heading) ? heading : '')
  const siteName = short($('meta[property="og:site_name"]').attr('content'))
  const company = short(organization?.name) || short($('[itemprop="hiringOrganization"] [itemprop="name"]').first().text()) || short(labelledCompany) || (/^(官网|招聘|人才招聘|职位列表|careers?|jobs?)$/i.test(siteName) ? '' : siteName)
  const emails = [...candidates].map(([email, context]) => ({ email, context }))
  const hiring = emails.filter(({ email, context }) => {
    const local = email.split('@')[0]
    if (/support|privacy|legal|service|sales|security|abuse|noreply|webmaster/i.test(local)) return false
    return /^(hr|jobs?|careers?|recruit\w*|talent)([._+-]|$)/i.test(local) || /简历|应聘|招聘邮箱|投递|recruit|resume|cv\b|apply|application/i.test(context)
  })
  const notes: string[] = []
  if (postings.length > 1) notes.push('页面包含多个岗位，请使用具体岗位详情链接或补充要投的岗位。')
  if (!company) notes.push('未识别到公司名称。')
  if (!role) notes.push('未识别到单一岗位名称。')
  if (hiring.length !== 1) notes.push(hiring.length > 1 ? '发现多个可能的招聘邮箱，请选择对应岗位的地址。' : '未识别到明确的招聘邮箱，请核对官网。')
  const subjectRequirement = rawText.match(/(?:邮件主题|邮件标题)[^\n]{0,180}/)?.[0]
  if (subjectRequirement) notes.push(`官网说明：${subjectRequirement}`)
  return { url, title, emails, company, role, recommendedEmail: hiring.length === 1 ? hiring[0].email : '', notes }
}

const MAX_PAGE_BYTES = 2 * 1024 * 1024
export async function readCareerPage(input: string, redirects = 0, deadline = Date.now() + 20000): Promise<CareerPage> {
  const parsed = sourceUrlSchema.safeParse(input)
  if (!parsed.success) throw new Error('请填写官网招聘页面的 HTTPS 地址（443 端口）')
  if (redirects > 4) throw new Error('招聘页面跳转次数过多，请复制最终页面地址')
  const url = new URL(parsed.data)
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
  if (result.redirect) return readCareerPage(result.redirect, redirects + 1, deadline)
  return extractCareerEmails(result.html ?? '', url.href)
}
