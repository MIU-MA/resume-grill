import { sourceUrlSchema, type CareerDiscovery, type CareerLink } from '../domain/mail-schema.ts'
import { normalizeCareerUrl } from './career-links.ts'
import { readCareerPage } from './public-page.ts'

export async function discoverCareers(input: string, read = readCareerPage): Promise<CareerDiscovery> {
  const start = normalizeCareerUrl(sourceUrlSchema.parse(input))!
  // Exact host only, plus its www alias. Linked external recruiting systems remain visible.
  const host = new URL(start).hostname.replace(/^www\./, '')
  const inScope = (value: string) => new URL(value).hostname.replace(/^www\./, '') === host
  const deadline = Date.now() + 18000
  const pending = [{ url: start, depth: 0 }]
  const visited = new Set<string>()
  const found = new Map<string, CareerLink>()
  const notes = new Set<string>()
  let pagesRead = 0
  while (pending.length && visited.size < 6 && Date.now() < deadline) {
    const current = pending.shift()!
    if (visited.has(current.url)) continue
    visited.add(current.url)
    try {
      const page = await read(current.url, 0, deadline, inScope)
      pagesRead++
      if (page.role && found.size < 100) found.set(page.url, { url: page.url, label: page.role, kind: 'job', sourceUrl: current.url })
      for (const link of page.links ?? []) {
        if (!found.has(link.url) && found.size < 100) found.set(link.url, link)
        if (link.kind === 'entry' && inScope(link.url) && current.depth < 2 && !visited.has(link.url) && !pending.some(item => item.url === link.url) && pending.length < 100) pending.push({ url: link.url, depth: current.depth + 1 })
      }
    } catch (error) {
      if (!pagesRead) throw error
      notes.add(`未能读取 ${current.url}：${error instanceof Error ? error.message : '读取失败'}`)
    }
  }
  if (pending.length) notes.add('已达到本次读取范围或时间限制。可复制列表中的招聘入口继续查找。')
  if ([...found.values()].some(link => !inScope(link.url))) notes.add('其他域名的招聘入口已列出，未继续抓取。可打开核对后复制该地址重新查找。')
  if (!found.size) notes.add('未找到可识别的招聘链接。可直接输入招聘页地址；需要登录或依赖脚本加载的职位列表暂不支持。')
  return { links: [...found.values()], pagesRead, notes: [...notes] }
}
