import { isWorkbenchUrl, PROFILE_LABELS, type WebsiteAnswer, type WebsiteJob, type WebsiteProfile, type WebsiteSnapshot } from '../domain/website-automation'

const message = document.getElementById('message')!
const list = document.getElementById('jobs')!
const toolbar = document.getElementById('toolbar')!
const navigation = document.getElementById('navigation')!
let snapshot: WebsiteSnapshot | null = null
let busy = false
let loaded = false
const tabOrigins = new Map<number, string>()
const edits = new Map<string, Map<string, string>>()
const statuses = { pending: '等待填写', opening: '正在打开', filling: '正在填写', waiting: '需要处理', ready: '已准备 · 待核对提交', done: '已手动确认提交', skipped: '已跳过' }
async function send(input: object) {
  const response = await chrome.runtime.sendMessage(input)
  if (!response?.ok) throw new Error(response?.error || '扩展未能响应，请重开面板。')
  return response.data as WebsiteSnapshot | null
}
function button(label: string, work: () => Promise<unknown>, primary = false) {
  const element = document.createElement('button'); element.textContent = label; element.disabled = busy
  if (primary) element.className = 'primary'
  element.onclick = () => {
    if (busy) return
    busy = true; element.disabled = true; message.className = ''; message.textContent = '正在处理…'
    void work().then(() => refresh()).catch(error => { message.textContent = error instanceof Error ? error.message : '操作失败'; message.className = 'error' }).finally(() => { busy = false; render() })
  }
  return element
}
async function openWorkbench() {
  const tabs = (await chrome.tabs.query({})).filter(tab => tab.url && isWorkbenchUrl(tab.url))
  const existing = tabs.find(tab => new URL(tab.url!).pathname === '/applications') ?? tabs[0]
  if (existing?.id !== undefined) {
    const url = new URL('/applications', existing.url!).href
    await chrome.tabs.update(existing.id, { active: true, ...(existing.url === url ? {} : { url }) })
    if (existing.windowId !== undefined) await chrome.windows.update(existing.windowId, { focused: true })
  } else await chrome.tabs.create({ url: 'http://127.0.0.1:3000/applications', active: true })
}
async function allow(origins: string[]) {
  if (!origins.length) return
  if (!await chrome.permissions.request({ origins: [...new Set(origins.map(origin => origin + '/*'))] })) throw new Error('未允许访问官网，任务已保留，可以稍后再开始。')
}
async function continueJob(job: WebsiteJob, inputs: Array<{ input: HTMLInputElement; key?: keyof WebsiteProfile; label: string }>) {
  const url = new URL(job.tabId === undefined ? job.url : tabOrigins.get(job.tabId) ?? job.url)
  if (url.protocol !== 'https:') throw new Error('请先打开 HTTPS 官网申请页面。')
  await allow([url.origin])
  const profile: WebsiteProfile = {}; const answers: WebsiteAnswer[] = []
  for (const field of inputs) {
    const value = field.input.value.trim()
    if (!value) continue
    if (field.key) profile[field.key] = value
    else answers.push({ origin: url.origin, scope: `${job.company}\n${job.role}`, label: field.label, value })
  }
  await send({ type: 'command', action: 'resume-job', id: job.id, profile, answers, authorizeCurrent: true })
}
function render() {
  toolbar.replaceChildren(); list.replaceChildren()
  navigation.replaceChildren(button('打开工作台', openWorkbench), button('刷新任务', async () => undefined))
  document.getElementById('progress')!.textContent = snapshot ? `${snapshot.jobs.filter(job => ['ready', 'done', 'skipped'].includes(job.status)).length}/${snapshot.jobs.length}` : ''
  if (!snapshot) {
    if (!message.classList.contains('error')) message.textContent = loaded ? '还没有收到填写任务。先在工作台选择岗位和简历。' : '正在读取任务…'
    const help = document.createElement('section'); help.className = 'empty-state'
    const title = document.createElement('h2'); title.textContent = '第一次使用'
    const steps = document.createElement('ol')
    for (const text of ['打开工作台，添加具体岗位链接并勾选官网岗位。', '点击“官网批量填写”，选择简历，核对可复用的资料，点击“发送到扩展”。', '回到这里，点击“开始填写”，允许本批招聘网站的访问权限。']) {
      const step = document.createElement('li'); step.textContent = text; steps.append(step)
    }
    const note = document.createElement('p'); note.className = 'detail'; note.textContent = '扩展负责填写，简历和岗位在工作台选择。若工作台打不开，请先在项目目录运行 npm run dev；默认地址为 127.0.0.1:3000。'
    help.append(title, steps, note); list.append(help); return
  }
  const pending = snapshot.jobs.filter(job => job.status === 'pending')
  const waiting = snapshot.jobs.filter(job => job.status === 'waiting')
  const ready = snapshot.jobs.filter(job => job.status === 'ready')
  if (!message.classList.contains('error')) message.textContent = snapshot.running ? '正在填写。需要你处理的页面会保留，其余岗位继续。' : pending.length ? `已收到 ${snapshot.jobs.length} 个岗位。点击“开始填写”后才会打开官网。` : waiting.length ? `${waiting.length} 个岗位需要处理。查看下方缺项，在官网处理后点击“继续填写”。` : ready.length ? `${ready.length} 个岗位等待你在官网核对并提交。` : '这批任务已结束，可以回工作台添加下一批。'
  const attachment = document.createElement('p'); attachment.className = 'detail'; attachment.textContent = `简历附件：${snapshot.attachmentName}`; list.append(attachment)
  if (snapshot.running || pending.length) toolbar.append(button(snapshot.running ? '暂停填写' : `开始填写（${pending.length}）`, async () => {
    if (snapshot!.running) await send({ type: 'command', action: 'pause' })
    else {
      await allow(snapshot!.jobs.filter(job => job.status === 'pending').map(job => new URL(job.url).origin))
      await send({ type: 'command', action: 'start' })
    }
  }, true))
  toolbar.append(button('清空这一批', async () => { if (confirm('清空扩展中的任务和简历附件？已填写的网页和已提交申请不会撤回。')) await send({ type: 'command', action: 'clear' }) }))
  for (const job of snapshot.jobs) {
    const article = document.createElement('article')
    const title = document.createElement('h2'); title.textContent = `${job.company} / ${job.role}`
    const status = document.createElement('div'); status.className = 'status'; status.textContent = statuses[job.status]
    const detail = document.createElement('p'); detail.className = 'detail'; detail.textContent = job.detail || new URL(job.url).hostname
    article.append(title, status, detail)
    if (job.result) {
      const summary = document.createElement('p'); summary.className = 'detail'
      summary.textContent = `已填写 ${job.result.filled.length} 项 · ${job.result.uploaded ? '附件已放入控件，仍需在官网核对上传结果' : '附件未确认上传，请在官网检查'}`
      article.append(summary)
    }
    const inputs: Array<{ input: HTMLInputElement; key?: keyof WebsiteProfile; label: string }> = []
    if (job.status === 'waiting') for (const field of job.result?.missing ?? []) {
      const label = document.createElement('label'); label.textContent = `${field.label}${field.kind === 'manual' || field.kind === 'upload' ? '（在官网处理）' : '（待补充）'}`
      if (field.kind === 'profile' || field.kind === 'answer') {
        const input = document.createElement('input'); input.maxLength = field.key ? 200 : 2000
        input.value = edits.get(job.id)?.get(field.label) ?? (field.key ? snapshot.profile[field.key] ?? '' : '')
        input.oninput = () => { if (!edits.has(job.id)) edits.set(job.id, new Map()); edits.get(job.id)!.set(field.label, input.value) }
        input.placeholder = field.key ? `填写一次，后续复用${PROFILE_LABELS[field.key]}` : '仅复用于同官网、同公司岗位的相同问题'
        label.append(input); inputs.push({ input, key: field.key, label: field.label })
      }
      article.append(label)
    }
    const actions = document.createElement('div'); actions.className = 'actions'
    if (job.tabId !== undefined) actions.append(button('打开官网核对', () => send({ type: 'focus', id: job.id })))
    if (['waiting', 'ready'].includes(job.status)) actions.append(button('继续填写', () => continueJob(job, inputs), job.status === 'waiting'), button('我已在官网提交', () => send({ type: 'command', action: 'done', id: job.id })))
    if (['pending', 'waiting', 'ready'].includes(job.status)) actions.append(button('跳过', () => send({ type: 'command', action: 'skip', id: job.id })))
    article.append(actions); list.append(article)
  }
}
async function refresh() {
  const previousId = snapshot?.id
  snapshot = await send({ type: 'snapshot' })
  loaded = true
  if (previousId !== snapshot?.id) edits.clear()
  await Promise.all((snapshot?.jobs ?? []).filter(job => job.tabId !== undefined).map(async job => {
    const tab = await chrome.tabs.get(job.tabId!).catch(() => null)
    if (tab?.url) { try { tabOrigins.set(job.tabId!, new URL(tab.url).origin) } catch { tabOrigins.delete(job.tabId!) } }
    else tabOrigins.delete(job.tabId!)
  }))
  if (!(document.activeElement instanceof HTMLInputElement)) render()
}
render()
void refresh().catch(error => { message.textContent = String(error); message.className = 'error'; render() })
setInterval(() => { if (!busy) void refresh().catch(() => undefined) }, 2000)
