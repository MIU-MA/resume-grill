import { isWorkbenchUrl } from '../domain/website-automation'

// Serialized by executeScript and run in the page's MAIN world. This checks
// the same page -> content script -> background -> page path as the workbench.
export function probeWorkbench(expectedUrl: string): Promise<{ ok: boolean; error?: string }> {
  if (location.href !== expectedUrl) return Promise.resolve({ ok: false, error: '页面已跳转，请回到工作台再连接。' })
  return new Promise(resolve => {
    const requestId = crypto.randomUUID()
    let staleError = '', bridgeReceived = false
    const finish = (result: { ok: boolean; error?: string }) => { window.removeEventListener('message', listener); clearTimeout(timer); resolve(result) }
    const listener = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin || event.data?.requestId !== requestId) return
      if (event.data.channel === 'resume-grill.website.progress' && event.data.step === 'bridge') { bridgeReceived = true; return }
      if (event.data.channel !== 'resume-grill.website.response') return
      if (!event.data.response?.ok && (event.data.response?.staleBridge || /连接已失效|Extension context invalidated/i.test(event.data.response?.error ?? ''))) { staleError = event.data.response?.error || '扩展连接已失效，请重新加载扩展后重试。'; return }
      finish(event.data.response?.ok ? { ok: true } : { ok: false, error: event.data.response?.error || '扩展后台未返回有效回应。' })
    }
    const timer = setTimeout(() => finish({ ok: false, error: staleError || (bridgeReceived ? '[RG-BACKGROUND] 通信脚本已收到网页请求，但扩展后台未回应。' : '[RG-BRIDGE] 通信脚本已加载，但网页未收到脚本接收确认。页面消息或脚本监听未能连通。') }), 10000)
    window.addEventListener('message', listener)
    window.postMessage({ channel: 'resume-grill.website.request', requestId, type: 'ping' }, location.origin)
  })
}

export function connectionDeadline<T>(operation: Promise<T>, stage: string, milliseconds = 6000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`[RG-TIMEOUT] ${stage}超过 ${milliseconds / 1000} 秒没有返回，请重试。`)), milliseconds)
    operation.then(value => { clearTimeout(timer); resolve(value) }, error => { clearTimeout(timer); reject(error) })
  })
}

export async function connectWorkbench(tab: chrome.tabs.Tab, options: { requestAccess?: boolean; onProgress?: (message: string) => void } = {}) {
  if (tab.id === undefined || !tab.url || !isWorkbenchUrl(tab.url)) throw new Error('请在当前浏览器打开本机工作台，再点击“连接工作台”。')
  // Request immediately from the popup click, before asynchronous tab work.
  const origins = [`http://${new URL(tab.url).hostname}/*`]
  options.onProgress?.('正在检查工作台访问权限…')
  const allowed = await connectionDeadline(options.requestAccess === false ? chrome.permissions.contains({ origins }) : chrome.permissions.request({ origins }), '工作台访问权限检查', options.requestAccess === false ? 6000 : 20000)
  if (!allowed) throw new Error('未允许访问本机工作台，请点击“连接工作台”授权。')
  const current = await connectionDeadline(chrome.tabs.get(tab.id), '工作台标签页读取')
  if (current.url !== tab.url) throw new Error('页面已跳转，请回到工作台再连接。')
  options.onProgress?.('正在加载网页通信脚本…')
  await connectionDeadline(chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, files: ['bridge.js'] }), '网页通信脚本加载')
  options.onProgress?.('正在等待工作台与扩展互相回应…')
  const results = await connectionDeadline(chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [0] }, world: 'MAIN', func: probeWorkbench, args: [tab.url] }), '网页与扩展往返检查', 12000)
  const result = results.find(item => item.frameId === 0)?.result
  if (!result?.ok) throw new Error(result?.error || '未能检查网页通信，请刷新工作台后重试。')
  return `已连接 ${new URL(tab.url).origin}，网页与扩展通信正常。`
}
