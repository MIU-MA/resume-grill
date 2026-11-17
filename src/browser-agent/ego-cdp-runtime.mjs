// Runs inside ego-browser's Node runtime. The token is supplied by a private
// temporary entry module, never in a URL or a command-line argument.
import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { writeFile } from 'node:fs/promises'

export async function runEgoCdpRuntime({ token, name, readyFile }) {
  const task = await taskSpace(name)
  const sessions = new Map(), events = [], targets = new Map()
  const created = new Set()
  const known = new Map()
  let queue = Promise.resolve(), closing = false, lastRequest = Date.now()
  const localTarget = async id => {
    const tab = (await task.tabs()).find(tab => tab.targetId === id)
    if (!tab) throw new Error('页面不属于工作台任务空间')
    if (tab.label) return task.page(tab.label)
    const info = targets.get(id)
    if (!info?.openerId || !created.has(info.openerId) || tab.openedBy === 'user') throw new Error('不能接管用户或来源不明的页面')
    return task.adopt(tab.page)
  }
  const update = async () => {
    const tabs = await task.tabs()
    targets.clear()
    for (const tab of tabs) {
      const previous = known.get(tab.targetId)
      let openerId = previous?.openerId
      if (!previous) {
        const result = await task.cdp('Target.getTargetInfo', { targetId: tab.targetId })
        openerId = result.targetInfo?.openerId !== tab.targetId ? result.targetInfo?.openerId : undefined
      }
      const info = { targetId: tab.targetId, type: 'page', url: tab.url, title: tab.title, browserContextId: `ego-space-${task.spaceId}`, ...(openerId ? { openerId } : {}) }
      targets.set(tab.targetId, info)
      if (JSON.stringify(known.get(tab.targetId)) !== JSON.stringify(info)) events.push({ method: 'Target.targetInfoChanged', params: { targetInfo: info } })
      known.set(tab.targetId, info)
    }
    for (const id of known.keys()) if (!targets.has(id)) { known.delete(id); events.push({ method: 'Target.targetDestroyed', params: { targetId: id } }) }
  }
  const drain = async () => {
    for (const [sessionId, page] of sessions) {
      try {
        for (const event of await page.events()) {
          if (event.method) events.push({ ...event, sessionId })
        }
      } catch { /* Closed targets are discovered by update(). */ }
    }
    await update()
    return events.splice(0)
  }
  const command = async ({ method, params = {}, sessionId }) => {
    const entry = (await listTaskSpaces()).find(entry => entry.id === task.spaceId)
    if (entry?.ownership !== 'agent') throw new Error('ego 任务空间已由用户接管，请重新连接')
    if (method === '__poll') return null
    if (method === 'Target.setDiscoverTargets') return {}
    if (method === 'Target.getTargets') { await update(); return { targetInfos: [...targets.values()] } }
    if (method === 'Target.createTarget') {
      const page = await task.newPage()
      if (params.url !== 'about:blank') await page.goto(params.url)
      await update()
      const targetId = (await task.tabs()).find(tab => tab.label === page.label).targetId
      created.add(targetId)
      return { targetId }
    }
    if (method === 'Target.closeTarget') {
      const page = await localTarget(params.targetId)
      await page.close()
      created.delete(params.targetId)
      for (const [id, entry] of sessions) if (entry === page || entry.label === page.label) sessions.delete(id)
      return { success: true }
    }
    if (method === 'Target.attachToTarget') {
      const page = await localTarget(params.targetId), id = `ego:${page.label}`
      sessions.set(id, page); return { sessionId: id }
    }
    const page = sessions.get(sessionId)
    if (!page) throw new Error('ego 页面会话已结束')
    if (method === 'Page.navigate') { await page.goto(params.url); return {} }
    return page.cdp(method, params)
  }
  const allowed = new Set(['Target.setDiscoverTargets', 'Target.getTargets', 'Target.createTarget', 'Target.closeTarget', 'Target.attachToTarget', 'Page.enable', 'Page.getFrameTree', 'Network.enable', 'Network.getResponseBody', 'Runtime.evaluate', 'Page.captureScreenshot', 'Page.navigate', 'DOM.setFileInputFiles', '__poll', '__close'])
  const server = createServer(async (req, res) => {
    const received = Buffer.from(req.headers.authorization?.replace(/^Bearer /, '') ?? ''), expected = Buffer.from(token)
    if (req.headers.host !== `127.0.0.1:${server.address().port}` || req.headers.origin || req.method !== 'POST' || req.url !== '/' || received.length !== expected.length || !timingSafeEqual(received, expected)) { res.writeHead(403); res.end(); return }
    lastRequest = Date.now()
    let body = '', size = 0
    try {
      for await (const chunk of req) { size += chunk.length; if (size > 128 * 1024) throw new Error('请求过长'); body += chunk }
      const input = JSON.parse(body)
      if (!allowed.has(input.method) || closing) throw new Error('不允许此浏览器操作')
      const work = queue.catch(() => {}).then(async () => {
        if (input.method === '__close') {
          closing = true
          const entry = (await listTaskSpaces()).find(entry => entry.id === task.spaceId)
          if (entry?.ownership === 'agent') await task.finish({ keep: [] })
          return { result: {}, events: [] }
        }
        let result, failure
        try { result = await command(input) } catch (error) { failure = error.message }
        return { ...(failure ? { error: { message: failure } } : { result }), events: await drain() }
      })
      queue = work
      res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(await work))
      if (closing) server.close()
    } catch (error) { res.writeHead(400); res.end(JSON.stringify({ error: { message: error.message } })) }
  })
  server.requestTimeout = 30000
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  await writeFile(readyFile, JSON.stringify({ port: server.address().port, spaceId: task.spaceId }), { mode: 0o600 })
  const watchdog = setInterval(() => {
    if (Date.now() - lastRequest < 45000 || closing) return
    closing = true
    void queue.catch(() => {}).then(async () => {
      const entry = (await listTaskSpaces()).find(entry => entry.id === task.spaceId)
      if (entry?.ownership === 'agent') await task.finish({ keep: [] })
    }).finally(() => server.close())
  }, 5000)
  await new Promise(resolve => server.once('close', resolve))
  clearInterval(watchdog)
}
