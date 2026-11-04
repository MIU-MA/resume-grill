import { z } from 'zod'
import { load } from 'cheerio'
import type { CareerDiscovery, CareerPage } from '../domain/mail-schema.ts'
import { sourceUrlSchema } from '../domain/mail-schema.ts'
import { readCareerJson } from './public-page.ts'
import { searchQueries } from '../domain/job-search.ts'

const ORIGIN = 'https://careers.tencent.com'
const postSchema = z.object({
  PostId: z.string().regex(/^\d{1,30}$/), RecruitPostName: z.string().min(1).max(120),
  Responsibility: z.string().optional(), Requirement: z.string().optional(),
  LocationName: z.string().optional(), RequireWorkYearsName: z.string().optional(),
  IsValid: z.boolean().optional(),
})
type Post = z.infer<typeof postSchema>
type ReadJson = typeof readCareerJson
function parseResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new Error('腾讯官网岗位接口未返回预期数据，请稍后重试或打开招聘官网查看')
  return result.data
}
const allowed = (value: string) => { const url = new URL(value); return url.origin === ORIGIN && /^\/tencentcareer\/api\/post\/(Query|ByPostId)$/.test(url.pathname) }
const text = (value = '') => load(value.replace(/\r\n/g, '\n')).text().trim()
export function isTencentCareer(value: string) {
  const parsed = sourceUrlSchema.safeParse(value)
  return parsed.success && new URL(parsed.data).origin === ORIGIN
}
function pageFor(post: Post, detail: boolean): CareerPage {
  const url = `${ORIGIN}/jobdesc.html?postId=${post.PostId}`
  const description = [post.LocationName && `工作地点：${post.LocationName}`, post.RequireWorkYearsName && `工作经验：${post.RequireWorkYearsName}`, post.Responsibility && `岗位职责\n${text(post.Responsibility)}`, post.Requirement && `任职要求\n${text(post.Requirement)}`].filter(Boolean).join('\n\n').slice(0, 12000)
  return { url, title: post.RecruitPostName, role: post.RecruitPostName, company: '腾讯', emails: [], recommendedEmail: '', jobDescription: description, notes: detail ? [] : ['官网列表中的岗位职责；完整任职要求可从详情页继续读取。'], links: [{ url, label: '官网申请', kind: 'apply', sourceUrl: url }] }
}
export async function readTencentCareer(input: string, deadline = Date.now() + 20000, read: ReadJson = readCareerJson): Promise<CareerPage> {
  if (!isTencentCareer(input)) throw new Error('不是腾讯招聘官网地址')
  const id = new URL(input).searchParams.get('postId')
  if (!id || !/^\d{1,30}$/.test(id)) throw new Error('请使用含 postId 的腾讯岗位详情链接')
  const endpoint = new URL('/tencentcareer/api/post/ByPostId', ORIGIN)
  endpoint.searchParams.set('postId', id); endpoint.searchParams.set('language', 'zh-cn')
  const result = parseResponse(z.object({ Code: z.literal(200), Data: postSchema }), await read(endpoint.href, deadline, allowed))
  if (result.Data.PostId !== id || result.Data.IsValid === false) throw new Error('官网岗位已下架或返回的岗位编号不一致')
  return pageFor(result.Data, true)
}
export async function discoverTencentCareers(input: string, keywords: string[] = [], read: ReadJson = readCareerJson): Promise<CareerDiscovery> {
  if (!isTencentCareer(input)) throw new Error('不是腾讯招聘官网地址')
  const deadline = Date.now() + 26000
  if (new URL(input).searchParams.has('postId')) return { links: [], pagesRead: 1, pages: [await readTencentCareer(input, deadline, read)], notes: [], listingRead: true }
  const query = searchQueries(keywords)
  const posts = new Map<string, Post>()
  let calls = 0, truncated = false
  for (const keyword of query.length ? query : ['']) {
    if (Date.now() >= deadline || posts.size >= 30) { truncated = true; break }
    const endpoint = new URL('/tencentcareer/api/post/Query', ORIGIN)
    endpoint.searchParams.set('keyword', keyword); endpoint.searchParams.set('pageIndex', '1'); endpoint.searchParams.set('pageSize', '30'); endpoint.searchParams.set('language', 'zh-cn'); endpoint.searchParams.set('area', 'cn')
    try {
      const result = parseResponse(z.object({ Code: z.literal(200), Data: z.object({ Count: z.number(), Posts: z.array(postSchema) }) }), await read(endpoint.href, deadline, allowed))
      calls++
      if (result.Data.Count > result.Data.Posts.length) truncated = true
      for (const post of result.Data.Posts) if (post.IsValid !== false && posts.size < 30) posts.set(post.PostId, post)
    } catch (error) { if (!calls) throw error; truncated = true; break }
  }
  const pages = [...posts.values()].map(post => pageFor(post, false))
  let detailFailures = 0
  for (let index = 0; index < Math.min(5, pages.length) && Date.now() < deadline; index++) {
    try { pages[index] = await readTencentCareer(pages[index].url, deadline, read); calls++ }
    catch { detailFailures++; break }
  }
  return { pagesRead: calls, pages, listingRead: true, links: pages.map(page => ({ url: page.url, label: page.role, kind: 'job', sourceUrl: input })), notes: [truncated ? '已读取公开接口的部分岗位（最多 30 个），并非全部搜索结果。' : '已读取腾讯官网公开岗位接口。', ...(detailFailures ? ['部分任职要求未能读取，已保留列表中的岗位职责。'] : [])] }
}
