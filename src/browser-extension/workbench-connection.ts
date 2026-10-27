import { isWorkbenchUrl } from '../domain/website-automation'

// Serialized by executeScript and run in the page's MAIN world. This checks
// the same page -> content script -> background -> page path as the workbench.
export function probeWorkbench(expectedUrl: string): Promise<{ ok: boolean; error?: string }> {
  if (location.href !== expectedUrl) return Promise.resolve({ ok: false, error: '页面已跳转，请回到工作台再连接。' })
  return new Promise(resolve => {
    const requestId = crypto.randomUUID()
    const finish = (result: { ok: boolean; error?: string }) => { window.removeEventListener('message', listener); clearTimeout(timer); resolve(result) }
    const listener = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'resume-grill.website.response' || event.data.requestId !== requestId) return
      finish(event.data.response?.ok ? { ok: true } : { ok: false, error: event.data.response?.error || '扩展后台未返回有效回应。' })
    }
    const timer = setTimeout(() => finish({ ok: false, error: '通信脚本已加载，但网页仍未收到回应。请查看扩展管理页的错误记录。' }), 10000)
    window.addEventListener('message', listener)
    window.postMessage({ channel: 'resume-grill.website.request', requestId, type: 'ping' }, location.origin)
  })
}

export async function connectWorkbench(tab: chrome.tabs.Tab, options: { requestAccess?: boolean; onProgress?: (message: string) => void } = {}) {
  if (tab.id === undefined || !tab.url || !isWorkbenchUrl(tab.url)) throw new Error('请在当前浏览器打开本机工作台，再点击“连接工作台”。')
  // Request immediately from the popup click, before asynchronous tab work.
  const origins = [`${new URL(tab.url).origin}/*`]
  options.onProgress?.('正在检查工作台访问权限…')
  const allowed = options.requestAccess === false ? await chrome.permissions.contains({ origins }) : await chrome.permissions.request({ origins })
  if (!allowed) throw new Error('未允许访问本机工作台，请点击“连接工作台”授权。')
  const current = await chrome.tabs.get(tab.id)
  if (current.url !== tab.url) throw new Error('页面已跳转，请回到工作台再连接。')
  options.onProgress?.('正在加载网页通信脚本…')
  await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, files: ['bridge.js'] })
  options.onProgress?.('正在等待工作台与扩展互相回应…')
  const results = await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, world: 'MAIN', func: probeWorkbench, args: [tab.url] })
  const result = results.find(item => item.frameId === 0)?.result
  if (!result?.ok) throw new Error(result?.error || '未能检查网页通信，请刷新工作台后重试。')
  return `已连接 ${new URL(tab.url).origin}，网页与扩展通信正常。`
}
