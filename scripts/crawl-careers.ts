import { mkdir, writeFile } from 'node:fs/promises'
import type { CareerDiscovery } from '../src/domain/mail-schema.ts'
import { readCareerPage } from '../src/mail-agent/public-page.ts'
import { crawlCareerSites, frontendReviewedAt } from '../src/data/career-sites.ts'

const sources = crawlCareerSites
const results = []
const isFrontend = (value: string) => /前端|front[\s_-]?end/i.test(value)
// Small, sequential public-page sample; no login, forms or email sending.
for (const source of sources) {
  const fetchedAt = new Date().toISOString()
  try {
    const page = await readCareerPage(source.url)
    // The entry page is manually verified. Read only its frontend details and direct
    // application links; site-wide navigation can contain unrelated HR product pages.
    const links = (page.links ?? []).filter(link => {
      let url = link.url
      try { url = decodeURIComponent(url) } catch { /* Keep the original URL. */ }
      return link.url !== page.url && (link.kind === 'apply' || (link.kind === 'job' && isFrontend(`${link.label} ${url}`)))
    })
    const discovery: CareerDiscovery = {
      links: [{ url: page.url, label: `${source.company}招聘官网`, kind: 'entry', sourceUrl: source.url }, ...links],
      pagesRead: 1,
      notes: [...page.notes],
    }
    const jobs = []
    for (const link of discovery.links.filter(item => item.kind === 'job').slice(0, 20)) {
      try {
        const detail = await readCareerPage(link.url)
        discovery.pagesRead++
        jobs.push({ url: detail.url, role: detail.role || detail.title.split(/[｜|]/)[0].trim() || link.label, title: detail.title, recommendedEmail: detail.recommendedEmail, emails: detail.emails, notes: detail.notes, fetchedAt: new Date().toISOString() })
      } catch (error) { discovery.notes.push(`岗位详情未能读取 ${link.url}：${error instanceof Error ? error.message : String(error)}`) }
    }
    results.push({ ...source, frontendReviewedAt, fetchedAt, status: 'fetched' as const, title: page.title, emails: page.emails, recommendedEmail: page.recommendedEmail, jobs, ...discovery })
    console.log(`${source.company}: ${discovery.links.length} links, ${page.emails.length} emails`)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    results.push({ ...source, frontendReviewedAt, fetchedAt, status: 'failed' as const, reason })
    console.log(`${source.company}: ${reason}`)
  }
}
const directory = new URL('../data/career-leads/', import.meta.url)
await mkdir(directory, { recursive: true })
await writeFile(new URL('latest.json', directory), JSON.stringify({ fetchedAt: new Date().toISOString(), focus: 'frontend', note: '前端岗位名称来自人工核对的官网正文；抓取时间与岗位核对日期分别记录，需核对岗位是否仍开放；未发送邮件或提交申请。', sources: results }, null, 2) + '\n')
const escape = (value: string) => value.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ')
const lines = ['# 前端招聘官网采集结果', '', `抓取时间：${new Date().toISOString()}`, '', '前端岗位名称来自人工核对的官网正文，岗位是否仍开放需在原站确认。邮箱来自公开页面，尚未逐岗位核对用途。未发送邮件或提交申请。', '']
for (const result of results) {
  lines.push(`## ${result.company}`, '', `来源：${result.url}`, '')
  lines.push(`官网列出的前端岗位：${result.frontendRoles.join('、')}`, '', `岗位核对日期：${result.frontendReviewedAt}`, '')
  if (result.status === 'failed') { lines.push(`读取失败：${result.reason}`, ''); continue }
  lines.push(`招聘邮箱（自动识别，需核对）：${result.recommendedEmail || '请在官网确认对应岗位的地址'}`, '', '| 类型 | 名称 | 链接 |', '| --- | --- | --- |')
  for (const link of result.links ?? []) lines.push(`| ${{ job: '岗位详情', entry: '招聘入口', apply: '在线申请' }[link.kind]} | ${escape(result.jobs.find(job => job.url === link.url)?.role || link.label)} | ${link.url} |`)
  if (result.jobs.length) {
    lines.push('', '### 已读取的岗位详情', '', '| 岗位 | 页面识别的招聘邮箱 |', '| --- | --- |')
    for (const job of result.jobs) lines.push(`| ${escape(job.role)} | ${job.recommendedEmail || '未识别到明确招聘邮箱'} |`)
  }
  for (const note of result.notes ?? []) lines.push('', note)
  lines.push('')
}
await writeFile(new URL('latest.md', directory), lines.join('\n'))
