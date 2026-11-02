import { load } from 'cheerio'
import type { CareerPage } from '../domain/mail-schema.ts'
import { extractCareerLinks } from './career-links.ts'
import { extractCareerEmails } from './public-page.ts'

/** URLs come from rendered anchors; titles and excerpts stay within that card. */
export function renderedCareerCards(html: string, url: string): CareerPage[] {
  const $ = load(html), base = extractCareerEmails(html, url)
  const jobUrls = new Set(extractCareerLinks(html, url).filter(link => link.kind === 'job').map(link => link.url))
  const result = new Map<string, CareerPage>()
  $('a[href]').each((_, element) => {
    const card = $(element)
    let href: string
    try { href = new URL(card.attr('href')!, url).href } catch { return }
    if (!jobUrls.has(href)) return
    const heading = card.find('h1,h2,h3,h4,[class*="title"],[class*="Title"]').first()
    const role = (heading.text() || card.attr('aria-label') || card.text()).replace(/\s+/g, ' ').trim()
    if (!role || role.length > 120 || /^(?:查看|岗位|职位)?详情$|^申请|^投递/.test(role)) return
    const excerpt = card.find('[class*="description"],[class*="Description"],[class*="jobDesc"],[class*="job-desc"]').text().trim().slice(0, 12000)
    result.set(href, { url: href, title: role, role, company: base.company, emails: [], recommendedEmail: '', jobDescription: excerpt || undefined, links: [{ url: href, label: '官网申请', kind: 'apply', sourceUrl: url }], notes: ['来自官网已加载的职位卡片；未读取的任职要求不会补写。'] })
  })
  return [...result.values()]
}

export function renderedCareerDetail(html: string, url: string, title?: string): CareerPage {
  const $ = load(html)
  $('nav,header,footer,aside,[class*="recommend"],[class*="Recommend"],[class*="related"],[class*="Related"]').remove()
  let result = extractCareerEmails($.html(), url)
  if (!result.role) {
    const heading = $('h1,[class*="job-title"],[class*="jobTitle"],[class*="position-title"],[class*="positionTitle"],[class*="jobName"]').first().text().replace(/\s+/g, ' ').trim()
    const role = title || (heading.length <= 120 ? heading : '')
    if (role) {
      // Feed a real, observed card title into the existing section parser.
      $('h1').remove(); $('body').prepend($('<h1>').text(role))
      result = extractCareerEmails($.html(), url)
    }
  }
  if (!result.jobDescription && (result.role || title)) {
    $('script,style,noscript,button,form,[hidden],[aria-hidden="true"]').remove()
    $('br').replaceWith('\n'); $('div,p,section,article,li,h1,h2,h3,h4').append('\n')
    const lines = $('body').text().split(/\n+/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean)
    const start = lines.findIndex(line => /^(?:职位描述|岗位描述|岗位职责|工作职责|职责描述|任职要求|职位要求|岗位要求)(?:[:：]|$)/.test(line))
    if (start >= 0) {
      const end = lines.findIndex((line, index) => index > start && /^(?:推荐职位|相关职位|相似职位|你可能感兴趣|申请职位|立即申请|投递简历|立即投递)/.test(line))
      const description = lines.slice(start, end < 0 ? undefined : end).join('\n').slice(0, 12000)
      if (description.length > 25) result = { ...result, role: result.role || title!, jobDescription: description }
    }
  }
  // An observed detail URL identifies one job. Do not let a stale list/card
  // extracted from the same HTML replace its complete API-backed description.
  return title ? { ...result, role: title, jobs: undefined } : result
}
