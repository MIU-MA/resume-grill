import { isWorkbenchUrl } from '@/domain/website-automation'

export type ExtensionConnectionProgress = {
  step: 'request' | 'bridge' | 'background' | 'error'
  detail: string
  extensionVersion?: string
  extensionId?: string
}
export type ExtensionConnectionOptions = { onProgress?: (progress: ExtensionConnectionProgress) => void; signal?: AbortSignal }

export function requestWebsiteExtension<T>(type: 'ping' | 'snapshot' | 'stage', batch?: unknown, options: ExtensionConnectionOptions = {}): Promise<T> {
  if (!isWorkbenchUrl(location.href)) return Promise.reject(new Error(`[RG-ADDRESS] 当前地址 ${location.origin}${location.pathname} 不支持扩展连接，请使用 HTTP localhost / 127.0.0.1 的 3000 / 3107 端口。`))
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()
    let staleError = '', bridgeReceived = false, extensionVersion = '', extensionId = ''
    const notify = (step: ExtensionConnectionProgress['step'], detail: string) => options.onProgress?.({ step, detail, extensionVersion, extensionId })
    const clear = () => { window.removeEventListener('message', listener); options.signal?.removeEventListener('abort', abort); clearTimeout(timer) }
    const fail = (message: string) => { clear(); notify('error', message); reject(new Error(message)) }
    const abort = () => { clear(); reject(new Error('本次连接检查已取消。')) }
    const listener = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin || event.data?.requestId !== requestId) return
      if (event.data.channel === 'resume-grill.website.progress' && event.data.step === 'bridge') {
        bridgeReceived = true
        extensionVersion = typeof event.data.extensionVersion === 'string' ? event.data.extensionVersion.slice(0, 32) : ''
        extensionId = typeof event.data.extensionId === 'string' ? event.data.extensionId.slice(0, 64) : ''
        notify('bridge', `通信脚本已收到请求${extensionVersion ? ` · v${extensionVersion}` : ''}，正在等待后台。`)
        return
      }
      if (event.data.channel !== 'resume-grill.website.response') return
      if (!event.data.response?.ok && (event.data.response?.staleBridge || /连接已失效|Extension context invalidated/i.test(event.data.response?.error ?? ''))) {
        staleError = event.data.response?.error || '扩展连接已失效，请重新加载扩展后重试。'
        return
      }
      if (!event.data.response?.ok) { fail(event.data.response?.error || '[RG-BACKGROUND] 扩展后台返回了失败结果。'); return }
      const version = event.data.response.data?.extensionVersion
      if (typeof version === 'string') extensionVersion = version.slice(0, 32)
      clear()
      notify('background', `扩展后台已回应${extensionVersion ? ` · v${extensionVersion}` : ''}。`)
      resolve(event.data.response.data)
    }
    const timer = setTimeout(() => fail(staleError ? `[RG-STALE] ${staleError}` : bridgeReceived
      ? `[RG-BACKGROUND] 通信脚本已收到请求${extensionVersion ? `（v${extensionVersion}）` : ''}，但扩展后台在 10 秒内没有回应。`
      : '[RG-BRIDGE] 工作台已发出请求，但未收到通信脚本或后台的确认。尚不能确定扩展是否已加载；0.2.3 起会报告脚本接收状态。'), 10000)
    if (options.signal?.aborted) { abort(); return }
    options.signal?.addEventListener('abort', abort, { once: true })
    window.addEventListener('message', listener)
    notify('request', `工作台已发出检测请求 · ${location.origin}${location.pathname}`)
    window.postMessage({ channel: 'resume-grill.website.request', requestId, type, ...(type === 'stage' ? { batch } : {}) }, location.origin)
  })
}

/** Connection metadata only: no profile, resume, mail settings or batch payload. */
export function extensionConnectionReport(address: string, progress: ExtensionConnectionProgress[]) {
  return ['Resume Grill 扩展连接诊断', `工作台：${address}`, ...progress.map((item, index) => `${index + 1}. ${item.detail}${item.extensionId ? `（扩展 ID：${item.extensionId}）` : ''}`)].join('\n')
}
