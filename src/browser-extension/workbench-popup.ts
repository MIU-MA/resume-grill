import { isWorkbenchUrl } from '../domain/website-automation'
import { connectWorkbench } from './workbench-connection'

// Keep these controls mounted: batch polling must not remove a focused button
// between pointer-down and click, or replace a connection result with task text.
export function mountWorkbenchPopup(root: HTMLElement) {
  let tab: chrome.tabs.Tab | undefined
  let busy = false
  const target = document.createElement('p'); target.className = 'detail'
  const status = document.createElement('p'); status.className = 'detail'; status.setAttribute('role', 'status')
  const actions = document.createElement('nav'); actions.className = 'actions'; actions.setAttribute('aria-label', '工作台连接')
  const connect = document.createElement('button'); connect.textContent = '连接工作台'
  const open = document.createElement('button'); open.textContent = '打开工作台'
  actions.append(connect, open); root.append(target, actions, status)
  function controls() { connect.disabled = open.disabled = busy }
  function progress(message: string) { status.className = 'detail'; status.textContent = message }
  function fail(error: unknown) { status.className = 'error'; status.textContent = error instanceof Error ? error.message : '连接失败，请重试。' }
  async function findWorkbench() {
    const [current, tabs] = await Promise.all([chrome.tabs.query({ active: true, currentWindow: true }), chrome.tabs.query({})])
    const candidates = tabs.filter(item => item.url && isWorkbenchUrl(item.url)).sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
    tab = candidates.find(item => item.id === current[0]?.id) ?? candidates[0]
    target.textContent = tab?.url ? `工作台：${tab.url}` : '当前浏览器没有打开本机工作台。'
  }
  async function run(work: () => Promise<void>) {
    if (busy) return
    busy = true; controls()
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
    const origins = [`${new URL(tab.url).origin}/*`]
    if (!await chrome.permissions.contains({ origins })) { progress('点击“连接工作台”允许访问这个本机地址。'); return }
    // Reattach to an already-authorized tab, including after an extension update.
    progress(await connectWorkbench(tab, { requestAccess: false, onProgress: progress }))
  })
}
