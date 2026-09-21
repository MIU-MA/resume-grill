import { load } from 'cheerio'
import { sourceUrlSchema, type CareerLink } from '../domain/mail-schema.ts'

export function normalizeCareerUrl(value: string, base?: string) {
  try {
    const url = new URL(value, base)
    if (!sourceUrlSchema.safeParse(url.href).success) return null
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key)
    }
    url.searchParams.sort()
    return url.href
  } catch { return null }
}

export function extractCareerLinks(html: string, sourceUrl: string): CareerLink[] {
  const $ = load(html)
  const found = new Map<string, CareerLink>()
  const add = (href: string, text: string, knownJob = false) => {
    const url = normalizeCareerUrl(href, sourceUrl)
    if (!href.trim() || !url || href.startsWith('#') || found.size >= 100) return
    const parsed = new URL(url)
    let path = parsed.pathname + parsed.search
    try { path = decodeURIComponent(path) } catch { /* Keep malformed escapes as text. */ }
    const label = text.replace(/\s+/g, ' ').trim().slice(0, 160)
    if (/\.(pdf|docx?|zip|png|jpe?g|svg|xlsx?|mp4)(?:$|\?)/i.test(path) || /(?:login|logout|sign[-_]?in|privacy|cookie|隐私|登录)/i.test(path + ' ' + label)) return
    const hint = `${label} ${path}`
    let kind: CareerLink['kind']
    if (/立即申请|申请职位|申请岗位|立即投递|投递简历|在线申请|在线应聘|apply(?:\b|[_/-])|application[-_/]form/i.test(hint)) kind = 'apply'
    else if (!knownJob && /(?:jobs?|positions?|vacancies)\/(?:search|list|all|index)(?:[/?]|$)/i.test(path)) kind = 'entry'
    else if (knownJob || /工程师|开发|设计师|经理|专员|分析师|研究员|实习|助理|总监|顾问|engineer\b|developer\b|designer\b|analyst\b|scientist\b|(?:job|position|vacanc)[-_/]?(?:detail|view)|(?:jobs?|positions?|vacancies)\/[\w-]+|[?&](?:job_?id|position_?id)=/i.test(hint)) kind = 'job'
    else if (/招聘|加入我们|招贤纳士|人才招募|岗位|职位|careers?|recruit|\bjobs?\b|vacancies|join[-_ ]?us|opportunities/i.test(`${hint} ${parsed.hostname}`)) kind = 'entry'
    else return
    const previous = found.get(url)
    if (!previous || (previous.kind === 'entry' && kind !== 'entry')) found.set(url, { url, label: label || parsed.hostname + parsed.pathname, kind, sourceUrl })
  }
  const visit = (value: unknown, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 12) return
    if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1)); return }
    const item = value as Record<string, unknown>
    if (item['@type'] === 'JobPosting' || (Array.isArray(item['@type']) && item['@type'].includes('JobPosting'))) {
      if (typeof item.url === 'string') add(item.url, typeof item.title === 'string' ? item.title : '岗位详情', true)
    } else Object.values(item).forEach(child => visit(child, depth + 1))
  }
  $('script[type="application/ld+json"]').each((_, el) => {
    try { visit(JSON.parse($(el).text())) } catch { /* Ignore invalid metadata. */ }
  })
  $('script,style,noscript,template').remove()
  $('a[href]').each((_, el) => add($(el).attr('href') ?? '', $(el).text() || $(el).attr('aria-label') || $(el).attr('title') || ''))
  return [...found.values()]
}
