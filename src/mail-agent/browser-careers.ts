import { chromium, type Browser, type Page } from 'playwright-core'
import { extractCareerEmails, resolvePublicHost } from './public-page.ts'
import { readBrowserResource } from './browser-network.ts'
import { sourceUrlSchema, type CareerDiscovery, type CareerPage } from '../domain/mail-schema.ts'
import { companyFromCareerUrl } from '../data/career-sites.ts'
import { renderedCareerCards, renderedCareerDetail } from './rendered-career-pages.ts'
import { renderedJobData, type RenderedJobData } from './rendered-job-data.ts'
import { browserRequestAllowed, trustedPublicBrowserHost } from './browser-origins.ts'
import { matchesJobTitle, searchKeywords } from '../domain/job-search.ts'

export async function launchCareerBrowser(): Promise<Browser> {
  for (const channel of ['msedge', 'chrome']) {
    try { return await chromium.launch({ channel, headless: true, timeout: 8000, chromiumSandbox: true }) } catch { /* Try the next installed browser. */ }
  }
  try { return await chromium.launch({ headless: true, timeout: 8000, chromiumSandbox: true }) }
  catch { throw new Error('动态岗位读取需要本机安装 Edge 或 Chrome；也可运行 npx playwright-core install chromium') }
}

function matches(title: string, keywords: string[]) {
  return !keywords.length || matchesJobTitle(title, keywords)
}
async function settle(page: Page, deadline: number) {
  await page.waitForSelector('body', { timeout: Math.max(1, Math.min(5000, deadline - Date.now())) }).catch(() => undefined)
  await page.waitForLoadState('networkidle', { timeout: Math.max(1, Math.min(3500, deadline - Date.now())) }).catch(() => undefined)
  await page.waitForTimeout(Math.max(0, Math.min(700, deadline - Date.now())))
}
async function waitForDescription(page: Page, deadline: number) {
  await page.getByText(/^(?:岗位职责|工作职责|职位描述|职位要求|任职要求)[:：]?$/, { exact: true }).first().waitFor({ state: 'visible', timeout: Math.max(1, Math.min(5000, deadline - Date.now())) }).catch(() => undefined)
}

/** Anonymous isolated browser, never the user's profile. No resume or SMTP secrets enter it. */
export async function discoverBrowserCareers(input: string, keywords: string[] = [], options: { detail?: boolean; launch?: typeof launchCareerBrowser; onProgress?: (stage: string) => void; onResourceError?: (url: string, message: string) => void } = {}): Promise<CareerDiscovery> {
  sourceUrlSchema.parse(input)
  keywords = searchKeywords(keywords)
  const deadline = Date.now() + 45000
  const browser = await (options.launch ?? launchCareerBrowser)()
  const hardStop = setTimeout(() => { void browser.close().catch(() => undefined) }, Math.max(1, deadline - Date.now()))
  const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false, locale: 'zh-CN', viewport: { width: 1365, height: 900 } }).catch(async error => { clearTimeout(hardStop); await browser.close().catch(() => undefined); throw error })
  let requests = 0
  const collected = new Map<string, CareerPage>()
  const notes: string[] = ['已使用独立浏览器读取公开招聘页面。']
  const hosts = new Map<string, ReturnType<typeof resolvePublicHost>>()
  const resolveHost = (host: string, until = deadline) => {
    if (!hosts.has(host)) hosts.set(host, resolvePublicHost(host, until))
    return hosts.get(host)!
  }
  try {
    await context.route('**/*', async route => {
      const req = route.request()
      if (++requests > 220 || Date.now() >= deadline || ['image', 'media', 'font'].includes(req.resourceType())) { await route.abort().catch(() => undefined); return }
      try {
        const url = new URL(req.url())
        if (!browserRequestAllowed(url, req.method(), req.postDataBuffer()?.length ?? 0) || /(?:monitor_browser|\/collect\/|analytics|\/api\/(?:logts|speedts)|logger\/query|pbbatchts)/i.test(url.pathname)) { await route.abort(); return }
        if (trustedPublicBrowserHost(new URL(input).hostname) && trustedPublicBrowserHost(url.hostname)) {
          await resolveHost(url.hostname, deadline)
          await route.continue()
          return
        }
        const resource = await readBrowserResource(req.url(), req.method(), await req.allHeaders(), req.postDataBuffer(), deadline, resolveHost)
        await route.fulfill(resource)
      } catch (error) { options.onResourceError?.(req.url(), error instanceof Error ? error.message : '资源未读到'); await route.abort().catch(() => undefined) }
    })
    await context.routeWebSocket('**/*', socket => socket.close())
    const page = await context.newPage()
    const apiJobs = new Map<string, RenderedJobData>()
    const jsonTasks = new Set<Promise<void>>()
    page.on('response', response => {
      if (!/application\/json/i.test(response.headers()['content-type'] ?? '')) return
      const pending = (async () => { try { for (const job of renderedJobData(await response.json())) apiJobs.set(job.title, job) } catch { /* Not a job payload. */ } })()
      jsonTasks.add(pending); void pending.finally(() => jsonTasks.delete(pending))
    })
    context.on('page', popup => { if (context.pages().length > 2) void popup.close() })
    page.setDefaultTimeout(2500)
    const start = new URL(input)
    if (start.hostname === 'jobs.bytedance.com' && ['/', '/experienced/', '/experienced'].includes(start.pathname)) start.pathname = '/experienced/position'
    if (start.hostname === 'job.meituan.com') { start.hostname = 'zhaopin.meituan.com'; start.pathname = '/web/position' }
    await page.goto(start.href, { waitUntil: 'domcontentloaded', timeout: Math.max(1, Math.min(20000, deadline - Date.now())) })
    options.onProgress?.('页面已打开')
    await settle(page, deadline)
    if (!options.detail) {
      const entry = (extractCareerEmails(await page.content(), page.url()).links ?? []).find(link => link.kind === 'entry' && /社会招聘|所有职位|职位列表|搜索职位|social|positions/i.test(link.label) && link.url !== page.url())
      if (entry) { options.onProgress?.(`进入职位列表 ${entry.url}`); await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: Math.max(1, Math.min(12000, deadline - Date.now())) }); await settle(page, deadline) }
    }
    // Only use an explicitly labelled job-search box. Never fill application fields.
    if (keywords[0] && !options.detail) {
      if (start.hostname === 'jobs.bytedance.com') await page.locator('input[placeholder="搜索职位"]').filter({ visible: true }).first().waitFor({ state: 'visible', timeout: Math.max(1, Math.min(6000, deadline - Date.now())) }).catch(() => undefined)
      for (const selector of ['input[placeholder*="搜索职位"]', 'input[placeholder*="搜索岗位"]', 'input[type="search"]', 'input[placeholder*="关键词"],input[placeholder*="关键字"]', 'input[placeholder*="搜索"]']) {
        const search = page.locator(selector).filter({ visible: true }).first()
        if (!await search.count()) continue
        try {
          for (const keyword of keywords.slice(0, 3)) {
            if (Date.now() + 6000 >= deadline) break
            apiJobs.clear()
            options.onProgress?.(`搜索 ${keyword}`)
            await search.fill(keyword, { timeout: 5000 }); await search.press('Enter'); await settle(page, deadline)
            await Promise.allSettled([...jsonTasks])
            if ([...apiJobs.values()].some(job => matches(job.title, keywords)) || renderedCareerCards(await page.content(), page.url()).some(card => matches(card.role, keywords))) break
          }
          break
        }
        catch { notes.push('搜索框暂未响应，继续读取当前列表中的匹配岗位。') }
      }
    }
    if (!options.detail) {
      const until = Math.min(deadline - 5000, Date.now() + 7000)
      while (Date.now() < until) {
        await Promise.allSettled([...jsonTasks])
        if (apiJobs.size || renderedCareerCards(await page.content(), page.url()).length) break
        await page.waitForTimeout(350)
      }
    }
    await Promise.allSettled([...jsonTasks])
    if (options.detail) await waitForDescription(page, deadline)
    const html = await page.content()
    const root = options.detail ? renderedCareerDetail(html, page.url()) : extractCareerEmails(html, page.url())
    const cards = renderedCareerCards(html, page.url()).filter(card => matches(card.role, keywords))
    options.onProgress?.(`读到 ${cards.length} 个职位卡片、${apiJobs.size} 条岗位数据`)
    for (const card of cards) {
      const data = apiJobs.get(card.role)
      collected.set(card.url, data?.description.includes('任职要求') ? { ...card, jobDescription: data.description, notes: ['职位与任职要求来自此官网页面加载的公开岗位数据。'] } : card)
    }
    if (!cards.length && (root.role || root.jobs?.length)) collected.set(root.url, root)
    const links = root.links ?? []
    if (!options.detail && !cards.length) {
      const candidates = [...apiJobs.values()].filter(job => matches(job.title, keywords) || matches(job.description, keywords)).map(job => job.title)
      if (!candidates.length && keywords[0]) candidates.push(...(await page.getByText(keywords[0], { exact: false }).allTextContents()).map(value => value.trim()).filter(value => value.length > 4 && value.length < 100 && !/^[\d、.\s]|负责|熟悉|要求|搜索/.test(value)))
      for (const title of [...new Set(candidates)].slice(0, 4)) {
        if (Date.now() + 5000 >= deadline) break
        let target = page.getByText(title, { exact: true }).filter({ visible: true }).first()
        if (!await target.count()) target = page.getByText(title, { exact: false }).filter({ visible: true }).first()
        if (!await target.count()) continue
        const listUrl = page.url()
        try {
          await target.click()
          await page.waitForURL(url => url.href !== listUrl, { timeout: 2500 }).catch(() => undefined)
          const detailPage = context.pages().find(item => item !== page && !item.isClosed()) ?? page
          await settle(detailPage, deadline)
          const currentUrl = detailPage.url()
          if (currentUrl !== listUrl && sourceUrlSchema.safeParse(currentUrl).success) {
            const expected = apiJobs.get(title)
            if (expected && !new RegExp(`(?:^|[^a-zA-Z0-9])${expected.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-zA-Z0-9])`).test(currentUrl)) {
              notes.push(`详情编号尚未与职位对应：${title}`)
              if (detailPage !== page) await detailPage.close()
              else { await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => undefined); await settle(page, deadline) }
              continue
            }
            await waitForDescription(detailPage, deadline)
            const detail = renderedCareerDetail(await detailPage.content(), currentUrl, title)
            const fromApi = apiJobs.get(title)
            collected.set(currentUrl, { ...detail, role: title, company: detail.company || companyFromCareerUrl(input), jobDescription: fromApi?.description.includes('任职要求') ? fromApi.description : detail.jobDescription || fromApi?.description })
          }
          if (detailPage !== page) await detailPage.close()
          else if (page.url() !== listUrl) { await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 }); await settle(page, deadline) }
        } catch { notes.push(`岗位详情暂未读到：${title}`) }
      }
    }
    if (!options.detail) {
      const details = (cards.length ? cards.filter(card => !collected.get(card.url)?.jobDescription?.includes('任职要求')).map(card => ({ url: card.url, label: card.role })) : links.filter(link => link.kind === 'job' && matches(link.label, keywords))).slice(0, 3)
      for (const link of details) {
        if (Date.now() + 3000 >= deadline) { notes.push('时间限制内未读完所有详情，已读取岗位保留。'); break }
        try {
          const address = new URL(link.url)
          const anchor = page.locator(`a[href=${JSON.stringify(link.url)}],a[href=${JSON.stringify(address.pathname + address.search)}]`).filter({ visible: true }).first()
          const listUrl = page.url()
          if (await anchor.count()) { await anchor.evaluate(element => element.removeAttribute('target')); await anchor.click() }
          else await page.goto(link.url, { waitUntil: 'domcontentloaded', timeout: Math.max(1, Math.min(10000, deadline - Date.now())) })
          await page.waitForURL(link.url, { timeout: 2500 }).catch(() => undefined)
          const detailPage = context.pages().find(item => item !== page && !item.isClosed()) ?? page
          await settle(detailPage, deadline)
          if (detailPage.url() !== link.url) throw new Error('详情页面尚未到达对应职位')
          await waitForDescription(detailPage, deadline)
          const detail = renderedCareerDetail(await detailPage.content(), detailPage.url(), link.label)
          if (detail.role || detail.jobs?.length) collected.set(detail.url, { ...detail, company: detail.company || companyFromCareerUrl(input) })
          if (detailPage !== page) await detailPage.close()
          else if (page.url() !== listUrl && Date.now() + 3000 < deadline) { await page.goBack({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => undefined); await settle(page, deadline) }
        } catch { notes.push(`岗位详情暂未读到：${link.label}`) }
      }
    }
    const pages = [...collected.values()]
    if (!pages.length && !links.some(link => link.kind === 'job')) notes.push('动态页面未返回可识别的职位列表；可能需要登录、验证或选择招聘入口。')
    return { links, pages, pagesRead: 1 + pages.length, listingRead: pages.length > 0, notes }
  } catch (error) {
    if (collected.size) return { links: [], pages: [...collected.values()], pagesRead: collected.size, listingRead: true, notes: [...notes, '时间限制内未读完详情，已读取岗位保留。'] }
    if (Date.now() >= deadline) throw new Error('动态招聘页读取达到时间限制，可继续其他来源')
    throw error
  } finally { clearTimeout(hardStop); await context.close().catch(() => undefined); await browser.close().catch(() => undefined) }
}
