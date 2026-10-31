import { isWorkbenchUrl } from '../domain/website-automation'
import { connectWorkbench, connectionDeadline } from './workbench-connection'

// Keep these controls mounted: batch polling must not remove a focused button
// between pointer-down and click, or replace a connection result with task text.
export function mountWorkbenchPopup(root: HTMLElement) {
  root.replaceChildren()
  let tab: chrome.tabs.Tab | undefined
  let busy = false
  const target = document.createElement('p'); target.className = 'detail'
  const status = document.createElement('p'); status.className = 'detail'; status.setAttribute('role', 'status')
  const actions = document.createElement('nav'); actions.className = 'actions'; actions.setAttribute('aria-label', '工作台连接')
  const connect = document.createElement('button'); connect.textContent = '连接工作台'
  const open = document.createElement('button'); open.textContent = '打开工作台'
  const copy = document.createElement('button'); copy.textContent = '复制诊断信息'
  const diagnostics = document.createElement('details'); diagnostics.innerHTML = '<summary>连接检查记录</summary>'
  const log = document.createElement('pre'); log.style.whiteSpace = 'pre-wrap'; diagnostics.append(log)
  let records: string[] = []
  function record(message: string) { if (records.at(-1) !== message) records = [...records.slice(-19), message]; log.textContent = records.join('\n') }
  actions.append(connect, open, copy); root.append(target, actions, status, diagnostics)
  function controls() { connect.disabled = open.disabled = busy }
  function progress(message: string) { status.className = 'detail'; status.textContent = message; record(message) }
  function fail(error: unknown) { status.className = 'error'; status.textContent = error instanceof Error ? error.message : '连接失败，请重试。'; record(status.textContent); diagnostics.open = true }
  copy.onclick = () => {
    const report = ['Resume Grill 扩展连接诊断', `扩展版本：${document.getElementById('extension-version')?.textContent || '见面板顶部'}`, target.textContent, ...records].join('\n')
    if (!navigator.clipboard) { diagnostics.open = true; progress('请选中连接检查记录复制。'); return }
    void navigator.clipboard.writeText(report).then(() => { copy.textContent = '已复制' }).catch(() => { diagnostics.open = true; copy.textContent = '复制失败，可选中下方记录' })
  }
  async function findWorkbench() {
    const [current, tabs] = await connectionDeadline(Promise.all([chrome.tabs.query({ active: true, currentWindow: true }), chrome.tabs.query({})]), '工作台标签页查找')
    const candidates = tabs.filter(item => item.url && isWorkbenchUrl(item.url)).sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
    tab = candidates.find(item => item.id === current[0]?.id) ?? candidates[0]
    target.textContent = tab?.url ? `工作台：${new URL(tab.url).origin}${new URL(tab.url).pathname}` : '当前浏览器没有打开本机工作台。'
    record(target.textContent)
  }
  async function run(work: () => Promise<void>) {
    if (busy) return
    busy = true; controls()
    records = []; log.textContent = ''; diagnostics.open = false; copy.textContent = '复制诊断信息'
    try { await work() } catch (error) { fail(error) }
    finally { busy = false; controls() }
  }
  connect.onclick = () => { void run(async () => {
    if (!tab) {
      await findWorkbench()
      progress(tab ? '已找到工作台，点击“连接工作台”允许访问。' : '请先在这个浏览器打开本机工作台，再点击连接。')
      return
    }
    // No asynchronous tab lookup before the permission request in this click.
    progress(await connectWorkbench(tab, { onProgress: progress }))
  }) }
  open.onclick = () => { void run(async () => {
    await findWorkbench()
    if (tab?.id !== undefined) {
      await chrome.tabs.update(tab.id, { active: true, url: new URL('/applications', tab.url!).href })
      if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true })
    } else await chrome.tabs.create({ url: 'http://127.0.0.1:3000/applications', active: true })
  }) }
  void run(async () => {
    progress('正在查找工作台…')
    await findWorkbench()
    if (!tab?.url) { progress('单个官网可以直接填写；批量任务需要连接工作台。'); return }
    const origins = [`http://${new URL(tab.url).hostname}/*`]
    if (!await connectionDeadline(chrome.permissions.contains({ origins }), '工作台访问权限检查')) { progress('点击“连接工作台”允许访问这个本机地址。'); return }
    // Reattach to an already-authorized tab, including after an extension update.
    progress(await connectWorkbench(tab, { requestAccess: false, onProgress: progress }))
  })
}
