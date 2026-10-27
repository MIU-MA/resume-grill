import { isWorkbenchUrl } from '../domain/website-automation'

// Client-side navigation does not reinject content scripts. Check the current
// route for each request instead of deciding whether to listen only at load.
const bridgeWindow = window as Window & { __resumeGrillBridge?: (event: MessageEvent) => void }
if (bridgeWindow.__resumeGrillBridge) window.removeEventListener('message', bridgeWindow.__resumeGrillBridge)
const receive = (event: MessageEvent) => {
  if (!isWorkbenchUrl(location.href) || event.source !== window || event.origin !== location.origin || event.data?.channel !== 'resume-grill.website.request' || !['ping', 'stage', 'snapshot'].includes(event.data.type) || typeof event.data.requestId !== 'string') return
  const { requestId, type, batch } = event.data
  const origin = location.origin
  const reply = (response: unknown) => window.postMessage({ channel: 'resume-grill.website.response', requestId, response }, origin)
  try {
    chrome.runtime.sendMessage({ type, ...(type === 'stage' ? { batch } : {}) }, response => {
      const error = chrome.runtime.lastError
      reply(error ? { ok: false, error: `扩展通信中断，请刷新工作台后重试。${error.message ?? ''}` } : response ?? { ok: false, error: '扩展没有返回结果，请重新加载扩展，再刷新工作台。' })
    })
  } catch {
    reply({ ok: false, error: '扩展连接已失效。请刷新工作台；若仍失败，请在扩展管理页重新加载 Resume Grill，再刷新工作台。' })
  }
}
bridgeWindow.__resumeGrillBridge = receive
window.addEventListener('message', receive)
// Notify an already-open workbench after installation or reinjection. The page
// must still verify connectivity with its own request before showing connected.
if (isWorkbenchUrl(location.href)) window.postMessage({ channel: 'resume-grill.website.ready', url: location.href }, location.origin)
