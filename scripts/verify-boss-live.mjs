import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Read-only verification through an already connected local browser service.
// Never connects Chrome, searches, clicks a communication button or sends anything.
const origin = process.argv[2] || 'http://127.0.0.1:4327'
const address = new URL(origin)
if (address.protocol !== 'http:' || address.hostname !== '127.0.0.1' || address.username || address.password || address.pathname !== '/' || address.search || address.hash) throw new Error('只允许本机浏览器服务地址')
try {
  const html = await (await fetch(address, { signal: AbortSignal.timeout(2000) })).text()
  const token = html.match(/const token='([a-f0-9]{48})'/)?.[1]
  if (!token) throw new Error('未找到本次服务凭据，请确认服务版本')
  const request = async (path, body) => {
    const response = await fetch(new URL(path, address), { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) })
    const value = await response.json()
    if (!response.ok) throw new Error(value.error || `本机接口返回 ${response.status}`)
    return value
  }
  const before = await request('/status')
  if (!before.ready) { console.log(JSON.stringify({ ready: false, phase: before.phase, error: before.error || '', hint: '请在工作台连接 Chrome 并选择 BOSS 岗位列表页；脚本不会代替你授权。' })); process.exitCode = 2 }
  else {
    const read = await request('/jobs')
    if (read.state !== 'ready') throw new Error(read.message ?? '未读到岗位列表')
    const job = read.jobs.find(item => item.company && item.title)
    if (!job) throw new Error('当前页没有可核对公司和标题的岗位卡片，请选择岗位列表页')
    const result = await request('/inspect-job', { readId: read.readId, url: job.url })
    const after = await request('/status')
    const report = {
      at: new Date().toISOString(), expected: job, result,
      checks: { listPreserved: before.url === after.url, connected: after.ready, temporaryOpened: (after.protocolCommands?.['Target.createTarget'] || 0) > (before.protocolCommands?.['Target.createTarget'] || 0), temporaryCloseRequested: (after.protocolCommands?.['Target.closeTarget'] || 0) > (before.protocolCommands?.['Target.closeTarget'] || 0), sentCount: after.sentCount },
    }
    const directory = fileURLToPath(new URL('../.boss-agent/e2e/', import.meta.url))
    await mkdir(directory, { recursive: true })
    await writeFile(new URL('live-detail.json', new URL('../.boss-agent/e2e/', import.meta.url)), JSON.stringify(report, null, 2), { mode: 0o600 })
    console.log(JSON.stringify({ ready: true, title: job.title, company: job.company, kind: result.kind, matched: result.matched, descriptionLength: result.description.length, blockers: result.blockers, communication: result.communication, checks: report.checks }))
    if (!result.matched || result.blockers.length || !report.checks.listPreserved || after.sentCount !== 0) process.exitCode = 2
  }
} catch (error) { console.log(JSON.stringify({ ready: false, error: String(error.message).replace(/wss?:\/\/\S+/g, '[本机调试地址]') })); process.exitCode = 2 }
