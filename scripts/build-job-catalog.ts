import { writeFile } from 'node:fs/promises'
import type { CareerDiscovery, CareerPage } from '../src/domain/mail-schema.ts'
import { careerSites } from '../src/data/career-sites.ts'
import { seedJobs as existingJobs } from '../src/data/job-catalog.ts'
import { discoverCareers } from '../src/mail-agent/career-discovery.ts'
import { discoverBrowserCareers } from '../src/mail-agent/browser-careers.ts'
import { discoverTencentCareers, isTencentCareer } from '../src/mail-agent/tencent-careers.ts'
import { normalizeCareerUrl } from '../src/mail-agent/career-links.ts'

type SeedJob = {
  company: string
  role: string
  url: string
  sourceUrl: string
  email: string
  fetchedAt: number
}

const GENERIC = /^(?:申请|投递|立即申请|立即投递|申请职位|职位申请|立即申请职位|查看详情|详情|岗位详情|职位详情|查看职位|查看岗位|查看更多|更多|了解更多.*|职位列表|岗位列表|招聘职位|热招职位|实习生招聘|校园招聘|社会招聘|.*招聘|开发者|开发者中心|客服云|销售云|智能客服|在线客服|销售类|.*careers|apply|apply now|view job|details?)$/i
const arg = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3)
const limit = Number(arg('limit') ?? 0) || Infinity
const browserMode = arg('browser') ?? 'fallback'
const concurrency = Math.max(1, Number(arg('concurrency') ?? 4))
const forceAll = process.argv.includes('--all')
const companies = arg('companies')?.split(',').map(value => value.trim()).filter(Boolean)
const keywords = arg('keywords')?.split(',').map(value => value.trim()).filter(Boolean).slice(0, 6) ?? []

function normalize(url: string) {
  try {
    return (normalizeCareerUrl(url) ?? url).replace(/\/$/, '')
  } catch { return url }
}
function keyOf(url: string, role: string) { return `${normalize(url)}\n${role}` }
function roleOf(value: string | undefined) {
  const role = value?.replace(/\s+/g, ' ').trim() ?? ''
  if (!role || role.length < 2 || role.length > 120 || GENERIC.test(role)) return ''
  return role
}
function collect(company: string, discovery: CareerDiscovery, sourceUrl: string, fetchedAt: number, into: Map<string, SeedJob>) {
  const add = (role: string | undefined, url: string, email = '') => {
    const clean = roleOf(role)
    if (!clean || !/^https?:/i.test(url)) return
    const key = keyOf(url, clean)
    into.set(key, { company, role: clean, url, sourceUrl, email, fetchedAt })
  }
  for (const page of (discovery.pages ?? []) as CareerPage[]) {
    const email = page.recommendedEmail || ''
    if (page.jobs?.length) for (const job of page.jobs) add(job.role, page.url, job.recommendedEmail || email)
    else add(page.role, page.url, email)
  }
  for (const link of discovery.links) {
    if (link.kind === 'job' || link.kind === 'apply') add(link.label, link.url)
  }
}

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}超时`)), ms)
    work.then(value => { clearTimeout(timer); resolve(value) }, error => { clearTimeout(timer); reject(error) })
  })
}

async function discover(site: { company: string; url: string }) {
  let discovery: CareerDiscovery | null = null
  let source = 'http'
  if (isTencentCareer(site.url)) {
    const results = await Promise.allSettled((keywords.length ? keywords : ['']).map(term => discoverTencentCareers(site.url, term ? [term] : [])))
    const loaded = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
    if (loaded.length) return { discovery: { pagesRead: loaded.reduce((n, value) => n + value.pagesRead, 0), pages: loaded.flatMap(value => value.pages ?? []), links: loaded.flatMap(value => value.links), notes: loaded.flatMap(value => value.notes) }, source: 'official-api' }
  }
  if (browserMode !== 'always') {
    try { discovery = await withTimeout(discoverCareers(site.url), 24000, 'HTTP ') } catch (error) {
      console.log(`${site.company}: HTTP ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  const useful = !!discovery && ((discovery.pages ?? []).some(page => page.jobs?.length || page.role) || discovery.links.some(link => link.kind === 'job' || link.kind === 'apply'))
  if (!useful && browserMode !== 'never') {
    try {
      discovery = await withTimeout(discoverBrowserCareers(site.url, []), 55000, '浏览器')
      source = 'browser'
    } catch (error) {
      console.log(`${site.company}: browser ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return { discovery, source }
}

const jobs = new Map<string, SeedJob>()
for (const job of existingJobs) jobs.set(keyOf(job.url, job.role), job)
const seededSources = new Set(existingJobs.map(job => job.sourceUrl))
const targets = careerSites.filter(site => (!companies || companies.includes(site.company)) && (forceAll || !seededSources.has(site.url))).slice(0, limit)
console.log(`Base ${existingJobs.length} jobs; crawling ${targets.length} / ${careerSites.length} sites (browser=${browserMode}, concurrency=${concurrency})`)

const started = Date.now()
let writing = Promise.resolve(0)
let next = 0
let done = 0
const write = async () => {
  const rows = [...jobs.values()].sort((a, b) => a.company.localeCompare(b.company, 'zh-CN') || a.role.localeCompare(b.role, 'zh-CN'))
  const header = `// Generated by scripts/build-job-catalog.ts on ${new Date().toISOString()}.\n// Public career pages only; no applications or emails were sent.\n`
  const body = `export type SeedJob = {\n  company: string\n  role: string\n  url: string\n  sourceUrl: string\n  email: string\n  fetchedAt: number\n}\n\nexport const seedJobs: SeedJob[] = ${JSON.stringify(rows, null, 2)}\n`
  await writeFile(new URL('../src/data/job-catalog.ts', import.meta.url), header + body)
  return rows.length
}
const workers = Array.from({ length: Math.min(concurrency, targets.length) }, async () => {
  while (true) {
    const index = next++
    if (index >= targets.length) return
    const site = targets[index]
    const at = Date.now()
    try {
      const { discovery, source } = await discover(site)
      if (discovery) collect(site.company, discovery, site.url, Date.now(), jobs)
      done++
      console.log(`${done}/${targets.length} ${site.company}: ${source}, ${discovery?.pagesRead ?? 0} pages, ${jobs.size} total, ${Date.now() - at}ms`)
      if (done % 5 === 0) { writing = writing.then(write); await writing }
    } catch (error) {
      done++
      console.log(`${done}/${targets.length} ${site.company}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
})
await Promise.all(workers)
await writing
const total = await write()
console.log(`\n${total} jobs from ${new Set([...jobs.values()].map(row => row.sourceUrl)).size} sites in ${Math.round((Date.now() - started) / 1000)}s`)
// Browser resources can keep the event loop alive after a timeout; the file is already written.
process.exit(0)
