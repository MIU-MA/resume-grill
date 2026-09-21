import { mkdir, writeFile } from 'node:fs/promises'
import { discoverCareers } from '../src/mail-agent/career-discovery.ts'
import { readCareerPage } from '../src/mail-agent/public-page.ts'

const sources = [
  { company: '凌思微电子', url: 'https://www.linkedsemi.com/company/join.html' },
  { company: '美泰电子', url: 'https://www.mtmems.com/jobs.html' },
  { company: '微筑科技', url: 'https://www.webuild.cn/join/' },
  { company: '乐言科技', url: 'https://www.leyantech.com/joinUS.html' },
  { company: 'BoomingTech', url: 'https://boomingtech.jobs.feishu.cn/' },
]
const results = []
// Small, sequential public-page sample; no login, forms or email sending.
for (const source of sources) {
  const fetchedAt = new Date().toISOString()
  try {
    const page = await readCareerPage(source.url)
    const discovery = await discoverCareers(source.url, async (url, ...args) => url === source.url ? page : readCareerPage(url, ...args))
    const jobs = []
    for (const link of discovery.links.filter(item => item.kind === 'job').slice(0, 20)) {
      try {
        const detail = await readCareerPage(link.url)
        jobs.push({ url: detail.url, role: detail.role || detail.title.split(/[｜|]/)[0].trim() || link.label, title: detail.title, recommendedEmail: detail.recommendedEmail, emails: detail.emails, notes: detail.notes, fetchedAt: new Date().toISOString() })
      } catch (error) { discovery.notes.push(`岗位详情未能读取 ${link.url}：${error instanceof Error ? error.message : String(error)}`) }
    }
    results.push({ ...source, fetchedAt, status: 'fetched' as const, title: page.title, emails: page.emails, recommendedEmail: page.recommendedEmail, jobs, ...discovery })
    console.log(`${source.company}: ${discovery.links.length} links, ${page.emails.length} emails`)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    results.push({ ...source, fetchedAt, status: 'failed' as const, reason })
    console.log(`${source.company}: ${reason}`)
  }
}
const directory = new URL('../data/career-leads/', import.meta.url)
await mkdir(directory, { recursive: true })
await writeFile(new URL('latest.json', directory), JSON.stringify({ fetchedAt: new Date().toISOString(), note: '公开招聘页采集结果，需核对岗位是否仍开放；未发送邮件或提交申请。', sources: results }, null, 2) + '\n')
const escape = (value: string) => value.replace(/\|/g, '\\|').replace(/[\r\n]+/g, ' ')
const lines = ['# 官网招聘采集结果', '', `抓取时间：${new Date().toISOString()}`, '', '岗位是否仍开放需在原站确认。邮箱来自公开页面，尚未逐岗位核对用途。未发送邮件或提交申请。', '']
for (const result of results) {
  lines.push(`## ${result.company}`, '', `来源：${result.url}`, '')
  if (result.status === 'failed') { lines.push(`读取失败：${result.reason}`, ''); continue }
  lines.push(`公开邮箱：${result.emails?.map(item => item.email).join('、') || '未识别'}`, '', '| 类型 | 名称 | 链接 |', '| --- | --- | --- |')
  for (const link of result.links ?? []) lines.push(`| ${{ job: '岗位详情', entry: '招聘入口', apply: '在线申请' }[link.kind]} | ${escape(result.jobs.find(job => job.url === link.url)?.role || link.label)} | ${link.url} |`)
  if (result.jobs.length) {
    lines.push('', '### 已读取的岗位详情', '', '| 岗位 | 页面识别的招聘邮箱 |', '| --- | --- |')
    for (const job of result.jobs) lines.push(`| ${escape(job.role)} | ${job.recommendedEmail || '未识别到明确招聘邮箱'} |`)
  }
  for (const note of result.notes ?? []) lines.push('', note)
  lines.push('')
}
await writeFile(new URL('latest.md', directory), lines.join('\n'))
