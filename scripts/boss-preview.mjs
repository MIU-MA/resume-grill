import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { chromium } from 'playwright-core'
import { tsImport } from 'tsx/esm/api'

const { createBossBatch } = await tsImport('../src/browser-agent/boss-batch.ts', import.meta.url)
const { createBossSimulation } = await tsImport('../src/browser-agent/boss-simulation.ts', import.meta.url)
const { runBossComposer, inspectBossComposerDocument } = await tsImport('../src/browser-agent/boss-composer.ts', import.meta.url)
const { createBossDraftSession } = await tsImport('../src/browser-agent/boss-draft-session.ts', import.meta.url)
const { inspectBossDetail } = await tsImport('../src/browser-agent/boss-inspection.ts', import.meta.url)
const { chromeDebugEndpoint } = await tsImport('../src/browser-agent/chrome-connection.ts', import.meta.url)
const { BossBrowserReader } = await tsImport('../src/browser-agent/boss-reader.ts', import.meta.url)
const { bossPreparationSchema, prepareBossApplications } = await tsImport('../src/features/applications/website/lib/boss-preparation.ts', import.meta.url)

const root = fileURLToPath(new URL('../', import.meta.url))
const bossHost = host => host === 'zhipin.com' || host.endsWith('.zhipin.com')

export { chromeDebugEndpoint }

// A deliberately narrow read-only experiment. Unknown API calls fail closed.
export function previewRequestAllowed(address, method, type) {
  const url = new URL(address)
  if (url.protocol === 'data:' || url.protocol === 'blob:') return true
  if (url.protocol !== 'https:') return false
  // The website's own session-token bootstrap is needed even before QR login.
  if (method === 'POST' && url.hostname === 'www.zhipin.com' && url.pathname === '/wapi/zppassport/set/zpToken') return true
  if (method === 'POST' && url.hostname === 'www.zhipin.com' && url.pathname === '/wapi/zpCommon/toggle/all') return true
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) return false
  if (/\/(?:chat|friend|deliver|send|publish)(?:\/|\.|$)/i.test(url.pathname)) return false
  if (bossHost(url.hostname)) {
    if (!url.pathname.startsWith('/wapi/')) return true
    return /^\/wapi\/(?:zppassport\/|zpuser\/wap\/(?:getUserInfo\.json|getSecurityGuideV1)$|zpgeek\/(?:search\/|job\/detail|pc\/(?:recommend\/job\/|all\/filter\/conditions\.json)|common\/|config\/|resume\/(?:restrict\/list|complete\/step|parser\/querybar)\.json$|agreement\/update\/tip\.json$|webtopbanner\/query\.json$)|zpCommon\/data\/)/i.test(url.pathname)
  }
  // External subresources only; external documents and API calls stay blocked.
  return (['image', 'font', 'stylesheet', 'script', 'media'].includes(type) || url.pathname.startsWith('/static/'))
    && ['zhipin.com', 'zhipin.cn', 'bosszhipin.com', 'kanzhun.com'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))
}

export async function createBossPreview({ port = 4327, fixture = false, headless = false, stream = true, attach, deferConnect = false, draftTest = false, autoOpenBoss = true, deliveryDirectory = resolve(root, '.boss-agent/boss-batches'), simulationDirectory = resolve(root, '.boss-agent/simulations') } = {}) {
  const viewport = { width: 1280, height: 800 }
  if (typeof attach === 'string' && attach !== 'ego:') {
    const address = new URL(attach)
    if (!['http:', 'ws:'].includes(address.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(address.hostname) || address.username || address.password) throw new Error('只允许连接本机 Chrome 调试地址')
  }
  const token = randomBytes(24).toString('hex')
  const origin = `http://127.0.0.1:${port}`
  const profile = resolve(root, '.boss-agent/preview-profile-v1')
  const html = (await readFile(resolve(root, 'examples/boss-browser-preview.html'), 'utf8')).replaceAll('__SESSION_TOKEN__', token).replaceAll('__READ_ONLY__', String(!!attach))
  let browser, context, page, cdp, frame, frameAt = 0, frameCount = 0, inputBusy = false, lastError = ''
  const blocked = [], responses = [], navigations = []
  const simulations = createBossSimulation(simulationDirectory)
  const deliveries = createBossBatch(deliveryDirectory, () => attach && !inputBusy && browser?.isConnected() && page && !page.isClosed() ? { browser, source: page } : undefined, running => { inputBusy = running })
  const draftSession = createBossDraftSession()
  const candidates = new Map()
  const navigationTimes = []
  const protocolCommands = {}, documentRequests = []
  let lastPreparedCount = 0
  let lastRead
  const viewPage = () => deliveries.currentPage() ?? page
  const viewReady = () => !!viewPage() && !viewPage().isClosed() && (phase === 'connected' || !!deliveries.currentPage())
  let frameOwner
  let capturePending
  let liveFrameAt = 0
  let phase = 'disconnected', connecting = false, closing = false, nextTabId = 0
  const safeLocation = address => { const url = new URL(address); return url.protocol === 'about:' ? 'about:blank' : url.origin + url.pathname }
  const noteBlocked = (address, method) => {
    const url = new URL(address)
    const item = `${method} ${url.hostname}${url.pathname}`
    if (!blocked.includes(item)) blocked.push(item)
    if (blocked.length > 30) blocked.shift()
  }
  const fixtureHtml = `<!doctype html><meta charset="utf-8"><title>预览链路测试</title>
    <style>body{font:24px sans-serif}input{font-size:24px}section{height:1800px;background:linear-gradient(#fff,#dde5ed)}</style>
    <h1>浏览器画面测试</h1><input aria-label="测试输入"><button onclick="document.body.dataset.clicked='yes'">验证点击</button>
    <div class="job-card-wrapper"><div class="job-card-box"><a class="job-name" href="/job_detail/fixture-one.html?securityId=fixture-secret">全栈开发</a><span class="company-name">演示公司</span><span class="salary">10-15K</span></div></div>
    <div class="job-card-wrap"><a href="/job_detail/fixture-two.html?securityId=fixture-secret">前端开发</a><span class="company-name">演示公司二</span><span class="salary">&#xe001;&#xe002;K</span></div>
    <section>验证滚动</section>`
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; frame-ancestors 'self'; form-action 'none'")
    const reply = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)) }
    const requestOrigin = req.headers.origin
    let workbenchOrigin = false
    try { const url = new URL(requestOrigin); workbenchOrigin = url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.origin === requestOrigin } catch {}
    if (workbenchOrigin && !['/', '/view'].includes(req.url)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin)
      res.setHeader('Vary', 'Origin')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      if (req.headers.host === `127.0.0.1:${port}` && req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
    }
    if (req.headers.host !== `127.0.0.1:${port}` || requestOrigin && requestOrigin !== origin && !workbenchOrigin) { reply(403, { error: '仅允许当前本机验证页面访问' }); return }
    if (req.method === 'GET' && ['/', '/view'].includes(req.url)) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return }
    const supplied = Buffer.from(req.headers.authorization?.replace(/^Bearer /, '') ?? '')
    const expected = Buffer.from(token)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) { reply(401, { error: '请刷新验证页后重试' }); return }
    try {
      if (req.method === 'POST' && ['/boss-batch/preview', '/boss-batch/confirm'].includes(req.url)) {
        let size = 0; const chunks = []
        for await (const chunk of req) { size += chunk.length; if (size > 15 * 1024 * 1024) throw new Error('批次内容过大'); chunks.push(chunk) }
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        const result = req.url === '/boss-batch/preview' ? await deliveries.preview(input) : await deliveries.confirm(input.id, input.confirmed === true, input.defaultGreetingAccepted === true)
        reply(200, result); return
      }
      if (req.method === 'GET' && /^\/boss-batch\/[a-f0-9-]{36}$/.test(req.url)) { reply(200, await deliveries.status(req.url.split('/')[2])); return }
      if (req.method === 'POST' && /^\/boss-batch\/[a-f0-9-]{36}\/remaining$/.test(req.url)) {
        let size = 0; for await (const chunk of req) { size += chunk.length; if (size > 1000) throw new Error('请求过长') }
        reply(200, await deliveries.prepareRemaining(req.url.split('/')[2])); return
      }
      if (req.method === 'POST' && /^\/boss-batch\/[a-f0-9-]{36}\/stop$/.test(req.url)) { deliveries.stop(req.url.split('/')[2]); reply(202, { ok: true }); return }
      if (req.method === 'POST' && req.url === '/simulation') {
        let size = 0; const chunks = []
        for await (const chunk of req) { size += chunk.length; if (size > 15 * 1024 * 1024) throw new Error('模拟输入过大'); chunks.push(chunk) }
        const result = await simulations.start(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        reply(202, result); return
      }
      if (req.method === 'GET' && /^\/simulation\/[a-f0-9-]{36}$/.test(req.url)) { reply(200, await simulations.status(req.url.split('/')[2])); return }
      if (req.method === 'POST' && /^\/simulation\/[a-f0-9-]{36}\/stop$/.test(req.url)) { simulations.stop(req.url.split('/')[2]); reply(202, { ok: true }); return }
      if (req.method === 'GET' && req.url === '/live-frame') {
        const requestedPage = viewPage()
        const switching = () => reply(409, { code: 'FRAME_SWITCH', error: '正在切换本批岗位页面，保留上一帧' })
        if (!viewReady() && deliveries.currentPage()) { switching(); return }
        if (!viewReady() || !bossHost(new URL(viewPage().url()).hostname)) { reply(503, { error: 'BOSS 页面未连接，画面更新已停止' }); return }
        // Demand-driven, shared between viewers. Never navigate or focus the tab.
        if (!capturePending && (!frame || frameOwner !== viewPage() || Date.now() - liveFrameAt >= 750)) {
          capturePending = captureFrame().then(() => { liveFrameAt = Date.now() }).finally(() => { capturePending = undefined })
        }
        try { await capturePending }
        catch (failure) { if (requestedPage !== viewPage() || requestedPage.isClosed()) { switching(); return } throw failure }
        if (requestedPage !== viewPage() || frameOwner !== viewPage()) { switching(); return }
        if (!viewReady() || !frame || !bossHost(new URL(viewPage().url()).hostname)) { reply(503, { error: '页面已变化，请等待 BOSS 页面就绪后重新开始预览' }); return }
        res.writeHead(200, { 'Content-Type': 'image/jpeg' }); res.end(frame); return
      }
      if (req.method === 'GET' && req.url === '/frame') {
        if (!viewReady() || !frame || frameOwner !== viewPage()) { reply(503, { error: '浏览器暂未产生画面' }); return }
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'X-Frame-Count': String(frameCount), 'X-Frame-At': String(frameAt), 'X-Viewport-Width': String(viewport.width), 'X-Viewport-Height': String(viewport.height) }); res.end(frame); return
      }
      if (req.method === 'GET' && req.url === '/status') {
        if (viewReady()) Object.assign(viewport, await viewPage().evaluate(() => ({ width: innerWidth, height: innerHeight })).catch(() => viewport))
        reply(200, { ready: viewReady(), mode: attach ? 'existing' : 'dedicated', readOnly: false, localDraftFilling: !!attach, backend: attach === 'ego:' ? 'ego' : attach ? 'scoped-cdp' : 'playwright-fixture', protocolCommands, documentRequests, preparedCount: lastPreparedCount, sentCount: 0, phase, browserConnected: !!browser?.isConnected(), tabs: await listTabs(), frameCount, frameAt, viewport, url: viewPage() ? safeLocation(viewPage().url()) : '', error: lastError, blocked, responses, navigations }); return
      }
      if (req.method === 'POST' && req.url === '/connect') {
        if (!attach || connecting || browser?.isConnected()) { reply(409, { error: '请等待当前连接完成，或先断开再重试' }); return }
        void connectBrowser().catch(error => { lastError = error.message; phase = 'error' })
        reply(202, { phase }); return
      }
      if (req.method === 'POST' && req.url === '/open-boss') {
        if (!attach || !browser?.isConnected()) throw new Error('请先连接并授权 Chrome')
        if (connecting || inputBusy || phase === 'preparing' || phase === 'opening') throw new Error('页面正在准备，请等待完成')
        if (page && !page.isClosed() && phase === 'connected') { reply(200, { ok: true }); return }
        phase = 'opening'; lastError = ''
        try { page = await browser.openBossPage(); await listTabs(); if (page) { context = page.context(); await preparePage() } else phase = 'selecting' }
        catch (error) { phase = 'error'; lastError = error.message; throw error }
        reply(200, { ok: true }); return
      }
      if (req.method === 'POST' && req.url === '/refresh-tabs') {
        if (!browser?.isConnected()) throw new Error('Chrome 尚未连接，请先完成浏览器授权')
        if (connecting || inputBusy || phase === 'preparing' || phase === 'opening') throw new Error('当前操作尚未完成，请稍后刷新页面列表')
        const tabs = await listTabs()
        if (!page || page.isClosed() || phase === 'closed' || phase === 'error') { page = undefined; lastRead = undefined; frame = undefined; draftSession.clear(); phase = 'selecting' }
        lastError = ''; reply(200, { tabs }); return
      }
      if (req.method === 'POST' && req.url === '/select') {
        if (phase !== 'selecting') throw new Error('请先连接 Chrome，再选择 BOSS 页面')
        let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 1000) throw new Error('请求过长') }
        if (phase !== 'selecting') throw new Error('另一个页面正在准备，请等待完成')
        const target = candidates.get(JSON.parse(body).id)
        if (!target || target.isClosed() || !bossHost(new URL(target.url()).hostname)) throw new Error('该 BOSS 页面已关闭，请刷新列表')
        page = target; context = page.context(); phase = 'preparing'
        try { await preparePage() } catch (error) { lastError = error.message; phase = 'error'; throw error }
        reply(200, { ok: true }); return
      }
      if (req.method === 'POST' && req.url === '/disconnect') {
        if (connecting || inputBusy || phase === 'preparing' || phase === 'opening') throw new Error('操作尚未完成；授权弹窗可在 Chrome 中取消')
        await disconnectBrowser(); reply(200, { ok: true }); return
      }
      if (req.method === 'POST' && req.url === '/open') {
        if (attach) { reply(403, { error: '现有浏览器模式只读取页面，请自行在官网搜索' }); return }
        if (phase !== 'connected' || !page || page.isClosed()) throw new Error('请先选择 BOSS 页面并开始预览')
        let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 1000) throw new Error('请求过长') }
        const target = JSON.parse(body).target
        if (!['login', 'jobs'].includes(target)) throw new Error('只允许打开登录页或岗位页')
        lastError = ''
        await page.goto(`https://www.zhipin.com/${target === 'login' ? 'web/user/' : 'web/geek/job'}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
        reply(200, { ok: true }); return
      }
      if (req.method === 'POST' && req.url === '/input') {
        if (attach) { reply(403, { error: '现有浏览器模式不转发键鼠输入' }); return }
        if (inputBusy) { reply(409, { error: '上一次操作尚未完成' }); return }
        let body = ''
        for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 4096) { reply(413, { error: '输入过长' }); return } }
        const command = JSON.parse(body)
        if (phase !== 'connected' || !page || page.isClosed()) throw new Error('请先选择 BOSS 页面并开始预览')
        if (inputBusy) { reply(409, { error: '上一次操作尚未完成' }); return }
        inputBusy = true
        try {
          const position = Number.isFinite(command.x) && command.x >= 0 && command.x < viewport.width && Number.isFinite(command.y) && command.y >= 0 && command.y < viewport.height
          if (command.type === 'click' && position) await page.mouse.click(command.x, command.y)
          else if (command.type === 'wheel' && position && Number.isFinite(command.delta) && Math.abs(command.delta) <= 1200) { await page.mouse.move(command.x, command.y); await page.mouse.wheel(0, command.delta) }
          else if (command.type === 'text' && typeof command.text === 'string' && command.text.length > 0 && command.text.length <= 100) await page.keyboard.insertText(command.text)
          else if (command.type === 'key' && ['Enter', 'Backspace', 'Delete', 'Tab', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(command.key)) await page.keyboard.press(command.key)
          else throw new Error('不支持的输入')
        } finally { inputBusy = false }
        reply(200, { ok: true }); return
      }
      if (req.method === 'POST' && req.url === '/search') {
        if (!attach || phase !== 'connected' || !page || page.isClosed() || inputBusy) throw new Error('请先选择 BOSS 页面')
        let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 2000) throw new Error('搜索词过长') }
        const query = JSON.parse(body).query
        if (typeof query !== 'string' || !query.trim() || query.length > 120) throw new Error('请填写不超过 120 字的岗位方向')
        inputBusy = true; lastRead = undefined
        try { await page.searchJobs(query.trim()) } finally { inputBusy = false }
        reply(200, { ok: true }); return
      }
      if (req.method === 'POST' && req.url === '/capture') {
        if (!viewReady()) throw new Error('请先选择 BOSS 页面')
        await captureFrame(); reply(200, { frameCount }); return
      }
      if (['/open-existing-chats', '/composer', '/composer-diagnostics', '/draft-test', '/draft-preview', '/fill-draft'].includes(req.url)) {
        if (!attach || phase !== 'connected' || !page || page.isClosed() || inputBusy) throw new Error('请先连接 BOSS 页面并等待当前操作结束')
        if (req.method === 'POST' && req.url === '/open-existing-chats') { inputBusy = true; try { await page.openExistingChats(); reply(200, { ok: true }); return } finally { inputBusy = false } }
        if (req.method === 'GET' && req.url === '/composer') { reply(200, await page.evaluate(runBossComposer, { action: 'inspect' })); return }
        if (req.method === 'GET' && req.url === '/composer-diagnostics') { reply(200, await page.evaluate(inspectBossComposerDocument)); return }
        if (req.method === 'POST' && ['/draft-preview', '/fill-draft'].includes(req.url)) {
          let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 10000) throw new Error('招呼语过长') }
          const input = JSON.parse(body)
          if (inputBusy) throw new Error('其他操作已开始，请等待完成')
          inputBusy = true
          try {
            const result = req.url === '/draft-preview' ? await draftSession.preview(page, input) : await draftSession.fill(page, input.id, input.confirmed === true)
            reply(200, result); return
          } finally { inputBusy = false }
        }
        if (req.method === 'POST' && req.url === '/draft-test') {
          if (!draftTest) { reply(403, { error: '当前会话未启用草稿填写测试' }); return }
          let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 3000) throw new Error('测试文本过长') }
          const input = JSON.parse(body)
          if (typeof input.text !== 'string' || typeof input.clear !== 'boolean') throw new Error('无效测试参数')
          if (inputBusy) throw new Error('其他操作已开始，请等待完成')
          inputBusy = true
          try { reply(200, await page.evaluate(runBossComposer, { action: 'test', ...input })); return } finally { inputBusy = false }
        }
      }
      if (req.method === 'POST' && req.url === '/inspect-job') {
        if (!attach || !browser?.isConnected() || phase !== 'connected' || !lastRead || !page || page.isClosed()) throw new Error('请先读取当前列表的岗位')
        const snapshot = lastRead
        let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 3000) throw new Error('请求过长') }
        const input = JSON.parse(body)
        const expected = snapshot.jobs.find(job => job.url === input.url)
        if (!expected || input.readId !== snapshot.id || snapshot !== lastRead || snapshot.page !== page || snapshot.url !== page.url()) throw new Error('岗位列表已变化，请重新读取')
        if (inputBusy) throw new Error('上一次读取尚未完成')
        inputBusy = true
        try {
          const result = await browser.withJobPage(expected.url, page, async target => {
            const until = Date.now() + 8000
            let result
            do {
              result = await inspectBossDetail(target, expected)
              if (result.kind === 'login' || result.kind === 'verification' || result.kind === 'detail' && result.title && result.company && result.description) break
              await new Promise(done => setTimeout(done, 250))
            } while (Date.now() < until)
            return result
          })
          if (snapshot !== lastRead || snapshot.page !== page || snapshot.url !== page.url()) throw new Error('读取期间岗位列表已变化，结果未采用')
          snapshot.details ??= new Map()
          snapshot.details.set(expected.url, result)
          reply(200, result); return
        } finally { inputBusy = false }
      }
      if (req.method === 'POST' && req.url === '/prepare') {
        if (phase !== 'connected' || !lastRead || !page || page.isClosed()) throw new Error('请先读取当前页面的岗位')
        const snapshot = lastRead
        let size = 0; const chunks = []
        for await (const chunk of req) { size += chunk.length; if (size > 128 * 1024) throw new Error('简历文字过长，请保留相关经历'); chunks.push(chunk) }
        const input = bossPreparationSchema.parse(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        if (lastRead !== snapshot || input.readId !== snapshot.id || snapshot.page !== page || snapshot.url !== page.url()) throw new Error('岗位列表已变化，请重新拉取后准备')
        const currentJobs = await collectJobs()
        if (lastRead !== snapshot || phase !== 'connected' || JSON.stringify(currentJobs) !== JSON.stringify(snapshot.jobs)) throw new Error('岗位列表已变化，请重新拉取后准备')
        const enrichedJobs = snapshot.jobs.map(job => {
          const detail = snapshot.details?.get(job.url)
          return detail?.matched && !detail.blockers.length ? { ...job, description: detail.description, descriptionSource: 'detail' } : job
        })
        const result = prepareBossApplications(enrichedJobs, input); lastPreparedCount = result.prepared.length
        reply(200, result); return
      }
      if (req.method === 'GET' && req.url === '/job-structure') {
        if (phase !== 'connected' || !page || page.isClosed()) throw new Error('请先选择 BOSS 页面')
        const nodes = await page.locator('.job-card-wrapper, .job-card-box, .job-card-wrap').evaluateAll(cards => [...(cards[0]?.querySelectorAll('a, h3, h4, span') ?? [])].slice(0, 35).map(node => ({ tag: node.tagName, class: node.className, text: node.textContent?.trim().slice(0, 100), ...(node.tagName === 'A' ? { href: new URL(node.href).pathname } : {}) })))
        reply(200, { nodes }); return
      }
      if (req.method === 'GET' && req.url === '/jobs') {
        if (phase !== 'connected' || !page || page.isClosed()) throw new Error('请先选择 BOSS 页面并开始预览')
        const source = page, address = page.url()
        const jobs = await collectJobs()
        const text = await source.locator('body').innerText({ timeout: 3000 })
        if (source !== page || address !== page.url()) throw new Error('读取期间页面已变化，请等待搜索完成后重新读取')
        const snapshot = { id: randomBytes(12).toString('hex'), page: source, url: address, jobs }
        lastRead = snapshot
        reply(200, { readId: snapshot.id, jobs, needsLogin: /扫码登录|登录后查看|登录\/注册/.test(text), needsVerification: /安全验证|滑动验证|请完成验证/.test(text) }); return
      }
      reply(404, { error: '没有此操作' })
    } catch (error) { reply(400, { error: error?.issues?.[0]?.message ?? (error instanceof Error ? error.message : '验证失败') }) }
  })
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done) })
  async function collectJobs() {
    return page.locator('.job-card-wrapper, .job-card-box, .job-card-wrap').evaluateAll(cards => {
          const seen = new Set()
          return cards.map(card => {
          const link = card.querySelector('a[href*="/job_detail/"]')
          if (!link) return null
          card = link.closest('li') ?? card
          const url = new URL(link.href)
          if (url.protocol !== 'https:' || !(url.hostname === 'zhipin.com' || url.hostname.endsWith('.zhipin.com'))) return null
          const href = url.origin + url.pathname
          if (seen.has(href)) return null
          const title = ((card.querySelector('.job-name, .job-title, [class*=job-name], [class*=job-title]') ?? link).getAttribute('title') || (card.querySelector('.job-name, .job-title, [class*=job-name], [class*=job-title]') ?? link).textContent || '').trim().replace(/[\uE000-\uF8FF].*$/s, '').replace(/\s*\d+(?:\.\d+)?[-–]\d+(?:\.\d+)?[Kk万千].*$/s, '').trim()
          if (!title) return null
          seen.add(href)
          const salary = card.querySelector('.salary')?.textContent?.trim() ?? ''
          return { title, company: card.querySelector('.company-name, a[href*="/gongsi/"]')?.textContent?.trim() ?? '', salary: /[\uE000-\uF8FF]/.test(salary) ? '' : salary, url: href, description: (card.querySelector('.job-desc, .job-info, .job-labels, .tag-list')?.textContent ?? card.innerText).trim().slice(0, 1200) }
          }).filter(Boolean).slice(0, 30)
        })
  }
  async function captureFrame() {
    const target = viewPage()
    const address = target.url()
    const size = await target.evaluate(() => ({ width: innerWidth, height: innerHeight }))
    const shot = await target.screenshot({ type: 'jpeg', quality: 65 })
    if (viewPage() !== target || target.url() !== address || phase === 'disconnected' || target.isClosed()) return
    Object.assign(viewport, size); frameOwner = target; frame = shot; frameAt = Date.now(); frameCount++
  }
  async function listTabs() {
    if (!browser?.isConnected()) return []
    const pages = await browser.listPages()
    for (const [id, target] of candidates) if (!pages.includes(target)) candidates.delete(id)
    for (const target of pages) if (![...candidates.values()].includes(target)) candidates.set(`tab-${++nextTabId}`, target)
    return Promise.all([...candidates].map(async ([id, target]) => ({ id, url: safeLocation(target.url()), title: await target.title().catch(() => '标题暂不可读') })))
  }
  async function connectBrowser() {
    connecting = true; phase = attach === 'ego:' ? 'preparing' : 'awaiting-permission'; lastError = ''
    try {
      const endpoint = attach === true ? await chromeDebugEndpoint() : attach
      const connected = await BossBrowserReader.connect(endpoint)
      if (closing) { await connected.close(); return }
      browser = connected; phase = 'selecting'
      for (const key of Object.keys(protocolCommands)) delete protocolCommands[key]
      connected.on('command', method => { protocolCommands[method] = (protocolCommands[method] ?? 0) + 1 })
      connected.on('disconnected', () => { if (browser === connected) { phase = 'disconnected'; frame = undefined; lastRead = undefined; candidates.clear() } })
      const tabs = await listTabs()
      if (autoOpenBoss && !closing) {
        if (!tabs.length) { phase = 'opening'; page = await connected.openBossPage(); await listTabs() }
        else if (tabs.length === 1) page = candidates.get(tabs[0].id)
        if (page) { context = page.context(); await preparePage() } else phase = 'selecting'
      }
    } finally { connecting = false }
  }
  async function disconnectBrowser() {
    draftSession.clear()
    phase = 'disconnected'; frame = undefined; lastRead = undefined; navigationTimes.length = 0
    await cdp?.send('Page.stopScreencast').catch(() => {})
    if (attach) {
      await cdp?.detach().catch(() => {})
      await browser?.close().catch(() => {})
    } else await context?.close().catch(() => {})
    browser = context = page = cdp = undefined; candidates.clear()
  }
  const close = async () => {
    closing = true
    await deliveries.close()
    await simulations.close()
    await disconnectBrowser()
    server.closeAllConnections(); await new Promise(done => server.close(done))
  }
  const guard = async route => {
    const request = route.request()
    if (fixture && request.url() === 'https://www.zhipin.com/preview-fixture') { await route.fulfill({ contentType: 'text/html', body: fixtureHtml }); return }
    if (previewRequestAllowed(request.url(), request.method(), request.resourceType())) await route.continue()
    else { noteBlocked(request.url(), request.method()); await route.abort('blockedbyclient') }
  }
  async function preparePage() {
    phase = 'preparing'; lastError = ''
    responses.length = blocked.length = navigations.length = navigationTimes.length = documentRequests.length = 0
    lastPreparedCount = 0
    lastRead = frame = undefined; frameCount = frameAt = 0
    const targetPage = page
    if (attach) page.removeAllListeners()
    Object.assign(viewport, await page.evaluate(() => ({ width: innerWidth, height: innerHeight })))
    // Never intercept or reload an existing user tab: this breaks website and extension startup.
    if (!attach) {
      await page.route('**/*', guard)
      await page.routeWebSocket('**/*', socket => { noteBlocked(socket.url(), 'WebSocket'); socket.close() })
    }
    page.on('framenavigated', target => {
      if (page !== targetPage || target !== targetPage.mainFrame()) return
      lastRead = undefined
      frame = undefined; liveFrameAt = 0
      navigations.push(safeLocation(target.url())); if (navigations.length > 10) navigations.shift()
    })
    page.on('request', request => {
      if (!attach || page !== targetPage || phase !== 'connected' || !request.isNavigationRequest() || request.frame() !== targetPage.mainFrame()) return
      const now = Date.now(); documentRequests.push({ at: now, url: safeLocation(request.url()) }); if (documentRequests.length > 30) documentRequests.shift(); navigationTimes.push(now)
      while (navigationTimes[0] < now - 10000) navigationTimes.shift()
      if (navigationTimes.length >= 4) {
        void disconnectBrowser().finally(() => { phase = 'error'; lastError = '官网连续跳转，已断开采集以停止干扰；不会自动刷新或重连' })
      }
    })
    page.on('response', async response => {
      if (page !== targetPage) return
      const url = new URL(response.url())
      if (url.pathname.startsWith('/wapi/') && bossHost(url.hostname)) {
        const item = { path: url.pathname, status: response.status() }
        responses.push(item)
        if (responses.length > 30) responses.shift()
        if (/\/search\/|\/recommend\/job\/|getUserInfo/.test(url.pathname)) {
          try { const data = await response.json(); item.code = data.code; item.message = typeof data.message === 'string' ? data.message.slice(0, 160) : ''; item.jobCount = data.zpData?.jobList?.length ?? null } catch { item.bodyUnavailable = true }
        }
      }
    })
    page.on('pageerror', error => { if (page === targetPage) lastError = error.message.slice(0, 200) })
    if (stream && !attach) {
      const session = cdp = await context.newCDPSession(page)
      session.on('Page.screencastFrame', event => {
        void session.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(() => {})
        if (page !== targetPage || closing || phase === 'disconnected' || phase === 'closed') return
        frameOwner = targetPage; frame = Buffer.from(event.data, 'base64'); frameAt = Date.now(); frameCount++
      })
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 65, maxWidth: 1280, maxHeight: 800, everyNthFrame: 1 })
    }
    if (!attach) {
      await page.goto(fixture ? 'https://www.zhipin.com/preview-fixture' : 'https://www.zhipin.com/web/geek/job', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(error => { lastError = `页面打开失败：${error.message.split('\n')[0]}` })
      await captureFrame()
    }
    phase = 'connected'
    page.once('close', () => { if (page === targetPage) { frame = undefined; phase = 'closed' } })
  }
  try {
    if (attach) {
      if (!deferConnect) {
        await connectBrowser()
        const tabs = await listTabs()
        if (phase !== 'connected' && tabs.length === 1) { page = candidates.get(tabs[0].id); context = page.context(); await preparePage() }
      }
    } else {
      await mkdir(profile, { recursive: true })
      const launchErrors = []
      for (const channel of ['msedge', 'chrome']) {
        try { context = await chromium.launchPersistentContext(fixture ? '' : profile, { channel, headless, viewport, serviceWorkers: 'block', acceptDownloads: false, timeout: 12000 }); break }
        catch (error) { launchErrors.push(`${channel}: ${error.message.split('\n')[0]}`) }
      }
      if (!context) throw new Error(`浏览器启动失败：${launchErrors.join('；')}`)
      page = context.pages()[0] ?? await context.newPage()
      await preparePage()
    }
    console.log(`工作台入口（含本次连接凭据，请勿分享）：http://localhost:3000/boss#boss-token=${token}&boss-origin=${encodeURIComponent(origin)}`)
    console.log(`BOSS 浏览器连接：${origin}\n${attach === 'ego:' ? '点击连接后在 ego 独立任务空间打开 BOSS，登录由用户手动完成。' : attach ? '点击连接并在 Chrome 允许授权后，会自动打开或复用 BOSS；多个页面时再选择。' : '专用浏览器已打开，登录由用户手动完成。'}批量投递只会在工作台整批确认后执行；诊断和模拟不会发送。`)
    return { origin, get page() { return page }, get context() { return context }, close, blocked, token }
  } catch (error) { await close(); throw error }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const address = process.argv.find(arg => arg.startsWith('--attach='))?.slice('--attach='.length)
    const attach = process.argv.includes('--ego') ? 'ego:' : address ?? (process.argv.includes('--attach') ? true : undefined)
    const preview = await createBossPreview({ fixture: process.argv.includes('--fixture'), headless: process.argv.includes('--headless'), attach, deferConnect: !!attach, draftTest: process.argv.includes('--allow-draft-test') })
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void preview.close().finally(() => process.exit(0)) })
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    console.error(`验证未启动：${message.replace(/wss?:\/\/\S+/g, '[本机调试地址]').slice(0, 800)}`)
    process.exitCode = 1
  }
}
