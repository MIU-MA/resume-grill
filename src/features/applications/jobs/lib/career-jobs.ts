import type { CareerDiscovery, CareerLink, CareerPage } from '@/domain/mail-schema'
import { careerUrlKey } from './pasted-career'
import { selectCareerJob } from './career-selection'

export type CachedCareerSite = {
  company: string
  url: string
  fetchedAt: number
  status: 'ok' | 'failed'
  pagesRead: number
  pages: CareerPage[]
  links: CareerLink[]
  notes: string[]
  error?: string
}
export type CareerJobsStore = { version: 1; sites: Record<string, CachedCareerSite> }
export type EmploymentType = 'campus' | 'social' | 'unknown'
export type JobDirection = 'frontend' | 'backend' | 'algorithm' | 'data' | 'product' | 'design' | 'operations' | 'test' | 'other'
export const EMPLOYMENT_LABELS: Record<EmploymentType, string> = { campus: '校招', social: '社招', unknown: '未标注' }
export const DIRECTION_LABELS: Record<JobDirection, string> = {
  frontend: '前端', backend: '后端', algorithm: '算法', data: '数据', product: '产品', design: '设计', operations: '运营', test: '测试', other: '其他',
}
export type CareerJobRow = {
  id: string
  company: string
  role: string
  url: string
  sourceUrl: string
  email: string
  fetchedAt: number
  siteUrl: string
  kind: 'page' | 'link'
  employment: EmploymentType
  direction: JobDirection
  page?: CareerPage
}

export function inferEmployment(...values: Array<string | undefined>): EmploymentType {
  const text = values.filter(Boolean).join(' ')
  if (/校招|校园|应届|春招|秋招|管培|实习生|实习|20\d{2}届|campus|graduate/i.test(text)) return 'campus'
  if (/社招|社会招聘|资深|高级|3\s*年|5\s*年|experienced|social/i.test(text)) return 'social'
  return 'unknown'
}
export function inferDirection(...values: Array<string | undefined>): JobDirection {
  const rules: Array<[JobDirection, RegExp]> = [
    ['test', /测试|\bqa\b|质量/i],
    ['algorithm', /算法|机器学习|深度学习|大模型|\bnlp\b|\bcv\b|推荐|aigc/i],
    ['data', /数据分析|数据开发|数仓|数据工程|\bbi\b/i],
    ['product', /产品经理|产品运营|产品/i],
    ['design', /设计|\bui\b|\bux\b|视觉|交互/i],
    ['operations', /运营|增长|内容/i],
    ['frontend', /前端|front[ -]?end|\bweb\b|\breact\b|\bvue\b|next\.?js/i],
    ['backend', /后端|back[ -]?end|服务端|\bjava\b|golang|go 语言|\bpython\b|\bnode\b|\bphp\b|c\+\+/i],
  ]
  // The position title takes precedence over tools mentioned in its description.
  for (const text of [values[0] ?? '', values.slice(1).filter(Boolean).join(' ')]) {
    const match = rules.find(([, pattern]) => pattern.test(text))
    if (match) return match[0]
  }
  return 'other'
}

export function emptyCareerJobs(): CareerJobsStore { return { version: 1, sites: {} } }

function key(url: string) {
  try { return careerUrlKey(url) } catch { return url }
}
function rowId(url: string, role: string) { return `${key(url)}\n${role.trim()}` }

/** Keep the previous readable jobs when a refresh fails; never turn a failure into an empty list. */
export function recordCareerDiscovery(store: CareerJobsStore, input: { company: string; url: string; discovery?: CareerDiscovery; error?: string; now?: number }): CareerJobsStore {
  const now = input.now ?? Date.now()
  const siteKey = key(input.url)
  const previous = store.sites[siteKey]
  if (!input.discovery || input.error) {
    return {
      ...store,
      sites: {
        ...store.sites,
        [siteKey]: {
          company: input.company,
          url: input.url,
          fetchedAt: now,
          status: 'failed',
          pagesRead: previous?.pagesRead ?? 0,
          pages: previous?.pages ?? [],
          links: previous?.links ?? [],
          notes: previous?.notes ?? [],
          error: input.error ?? '读取失败',
        },
      },
    }
  }
  return {
    ...store,
    sites: {
      ...store.sites,
      [siteKey]: {
        company: input.company,
        url: input.url,
        fetchedAt: now,
        status: 'ok',
        pagesRead: input.discovery.pagesRead,
        pages: input.discovery.pages ?? [],
        links: input.discovery.links.filter(link => link.kind === 'job' || link.kind === 'apply'),
        notes: input.discovery.notes,
      },
    },
  }
}

/** Flatten every cached source into one deduplicated row set for the list view. */
export function careerJobRows(store: CareerJobsStore): CareerJobRow[] {
  const rows: CareerJobRow[] = []
  const seen = new Set<string>()
  const pageUrls = new Set<string>()
  const add = (row: CareerJobRow) => {
    if (seen.has(row.id)) return
    seen.add(row.id)
    rows.push(row)
  }
  for (const site of Object.values(store.sites)) {
    for (const page of site.pages) {
      pageUrls.add(key(page.url))
      const jobs = page.jobs?.length
        ? page.jobs
        : page.role
          ? [{ id: '', role: page.role, emails: page.emails, recommendedEmail: page.recommendedEmail }]
          : []
      for (const job of jobs) {
        const chosen = 'id' in job && job.id ? selectCareerJob(page, job.id) : page
        const role = chosen.role || job.role || '岗位待核对'
        const employment = inferEmployment(role, chosen.title, chosen.jobDescription, job.role)
        const direction = inferDirection(role, chosen.title, chosen.jobDescription, job.role)
        add({
          id: rowId(chosen.url, role),
          company: chosen.company || site.company,
          role,
          url: chosen.url,
          sourceUrl: page.url || site.url,
          email: chosen.recommendedEmail || page.recommendedEmail || '',
          fetchedAt: site.fetchedAt,
          siteUrl: site.url,
          kind: 'page',
          employment,
          direction,
          page: chosen,
        })
      }
    }
    for (const link of site.links) {
      if (pageUrls.has(key(link.url))) continue
      const role = link.label.trim() || '岗位链接'
      add({
        id: rowId(link.url, role),
        company: site.company,
        role,
        url: link.url,
        sourceUrl: link.sourceUrl || site.url,
        email: '',
        fetchedAt: site.fetchedAt,
        siteUrl: site.url,
        kind: 'link',
        employment: inferEmployment(role),
        direction: inferDirection(role),
      })
    }
  }
  return rows.sort((a, b) => b.fetchedAt - a.fetchedAt || a.company.localeCompare(b.company, 'zh-CN') || a.role.localeCompare(b.role, 'zh-CN'))
}

export function careerSiteKey(url: string) { return key(url) }
