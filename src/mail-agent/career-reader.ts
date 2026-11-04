import type { CareerDiscovery, CareerPage } from '../domain/mail-schema.ts'
import { sourceUrlSchema } from '../domain/mail-schema.ts'
import { matchesJobTitle, searchKeywords } from '../domain/job-search.ts'
import { discoverCareers } from './career-discovery.ts'
import { readCareerPage } from './public-page.ts'
import { discoverBrowserCareers } from './browser-careers.ts'
import { discoverTencentCareers, isTencentCareer, readTencentCareer } from './tencent-careers.ts'

export async function discoverRecruitingPage(input: string, keywords: string[] = [], tools = { static: discoverCareers, browser: discoverBrowserCareers, tencent: discoverTencentCareers }): Promise<CareerDiscovery> {
  sourceUrlSchema.parse(input)
  keywords = searchKeywords(keywords)
  if (isTencentCareer(input)) {
    try { return await tools.tencent(input, keywords) } catch { /* Keep the original page reader available if the public API fails. */ }
  }
  let initial: CareerDiscovery | undefined
  try { initial = await tools.static(input) } catch { /* A browser can read script-generated navigation and redirects. */ }
  const titles = [...(initial?.pages ?? []).flatMap(page => [page.role, ...(page.jobs ?? []).map(job => job.role)]), ...(initial?.links ?? []).filter(link => link.kind === 'job').map(link => link.label)].filter(Boolean)
  if (titles.length && (!keywords.length || titles.some(title => matchesJobTitle(title, keywords)))) return initial!
  try {
    const rendered = await tools.browser(input, keywords)
    if (!initial) return rendered
    return { ...rendered, pages: [...new Map([...(initial?.pages ?? []), ...(rendered.pages ?? [])].map(page => [`${page.url}\n${page.role}`, page])).values()], listingRead: initial?.listingRead || rendered.listingRead, links: [...new Map([...(initial?.links ?? []), ...rendered.links].map(link => [link.url, link])).values()], notes: [...(initial?.notes ?? []), ...rendered.notes] }
  } catch (error) {
    if (initial) return { ...initial, notes: [...initial.notes, `动态读取未完成，已保留原网页的链接和内容。${error instanceof Error ? error.message : ''}`] }
    throw error
  }
}
export async function readRecruitingDetail(input: string): Promise<CareerPage> {
  sourceUrlSchema.parse(input)
  if (isTencentCareer(input) && new URL(input).searchParams.has('postId')) return readTencentCareer(input)
  let original: CareerPage | undefined
  try { original = await readCareerPage(input); if (original.role && original.jobDescription) return original } catch { /* Use rendered detail. */ }
  try {
    const result = await discoverBrowserCareers(input, [], { detail: true })
    const detail = result.pages?.find(page => page.role && page.jobDescription)
    if (detail) return detail
    if (original) return original
    throw new Error('招聘详情尚未加载出职责和要求，请重试此来源')
  } catch (error) { if (original) return { ...original, notes: [...original.notes, '动态详情未加载，保留原页面信息。'] }; throw error }
}
