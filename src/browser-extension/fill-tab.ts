import { NO_APPLICATION_FORM, type FormResult, type WebsiteAnswer, type WebsiteBatch, type WebsiteProfile } from '../domain/website-automation'

type FillData = { profile: WebsiteProfile; attachment?: WebsiteBatch['attachment'] | null; experiences?: WebsiteBatch['experiences']; answers: WebsiteAnswer[]; scope: string }

/** Only send personal data to documents on the explicitly selected origin. */
export async function fillTab(tabId: number, url: string, data: FillData): Promise<FormResult> {
  const origin = new URL(url).origin
  if (!origin.startsWith('https://') || !await chrome.permissions.contains({ origins: [origin + '/*'] })) throw new Error('尚未允许访问当前官网，请再次点击填写并允许访问。')
  let incomplete = false
  const inspect = () => {
    const frame = window.frameElement
    if (frame && (!frame.getClientRects().length || getComputedStyle(frame).visibility === 'hidden')) return ''
    return location.href
  }
  const probe = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, func: inspect }).catch(async () => {
    incomplete = true
    return chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, func: inspect })
  })
  if (probe.find(frame => frame.frameId === 0)?.result !== url) throw new Error('申请页面已变化，请重新打开扩展再填写。')
  const frames = probe.filter(frame => { try { return typeof frame.result === 'string' && new URL(frame.result).origin === origin } catch { return false } }).slice(0, 20)
  const injected = await chrome.scripting.executeScript({ target: { tabId, frameIds: frames.map(frame => frame.frameId) }, files: ['form-content.js'] })
  if ((await chrome.tabs.get(tabId)).url !== url) throw new Error('申请页面已变化，请重新打开扩展再填写。')
  const results: FormResult[] = []
  for (const frame of frames) {
    const documentId = injected.find(item => item.frameId === frame.frameId)?.documentId
    if (!documentId || documentId !== frame.documentId) { results.push(unreadFrame()); continue }
    try {
      const reply = await chrome.tabs.sendMessage(tabId, { type: 'fill-application', ...data, expectedUrl: frame.result }, { documentId }) as { result?: FormResult; error?: string }
      if (!reply?.result) throw new Error(reply?.error || '页面没有返回填写结果，请核对官网后重试。')
      results.push(reply.result)
    } catch (error) {
      if (frame.frameId === 0) throw error
      results.push(unreadFrame())
    }
  }
  if (incomplete || probe.some(frame => !!frame.result && !frames.includes(frame))) results.push(unreadFrame())
  const filled = results.flatMap(result => result.filled)
  const foundForm = results.some(result => result.filled.length || result.uploaded || result.missing.some(field => field.key))
  const missing = results.flatMap(result => result.missing).filter(field => !foundForm || field.label !== NO_APPLICATION_FORM)
  return { filled, uploaded: results.some(result => result.uploaded), missing, message: results.length === 1 ? results[0].message : `已检查 ${frames.length} 个页面区域，填写 ${filled.length} 项，请在官网核对${missing.length ? '并补充未填写项' : ''}。` }
}
function unreadFrame(): FormResult {
  return { filled: [], uploaded: false, missing: [{ kind: 'manual', label: '部分内嵌表单未能读取或属于其他站点，请在官网核对填写' }], message: '' }
}
