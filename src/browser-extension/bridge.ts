import { isWorkbenchUrl } from '../domain/website-automation'

if (isWorkbenchUrl(location.href)) window.addEventListener('message', event => {
  if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'resume-grill.website.request' || !['ping', 'stage', 'snapshot'].includes(event.data.type) || typeof event.data.requestId !== 'string') return
  const { requestId, type, batch } = event.data
  chrome.runtime.sendMessage({ type, ...(type === 'stage' ? { batch } : {}) }, response => {
    const error = chrome.runtime.lastError
    window.postMessage({ channel: 'resume-grill.website.response', requestId, response: error ? { ok: false, error: '扩展已更新，请刷新工作台。' } : response }, location.origin)
  })
})
