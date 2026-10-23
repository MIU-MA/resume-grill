import { z } from 'zod'
import { answerSchema, isWorkbenchUrl, profileSchema, sensitiveField, websiteBatchSchema, type FormResult, type WebsiteQueue } from '../domain/website-automation'
import { createWebsiteQueue } from './queue'

const KEY = 'website-queue:v1'
const storageReady = chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' })
const engine = createWebsiteQueue({
  load: async () => (await chrome.storage.local.get(KEY))[KEY] as WebsiteQueue | null ?? null,
  save: async queue => { if (queue) await chrome.storage.local.set({ [KEY]: queue }); else await chrome.storage.local.remove(KEY) },
  open: async url => {
    if (!(await chrome.permissions.contains({ origins: [new URL(url).origin + '/*'] }))) throw new Error('还未允许这个官网。请在扩展中允许访问后继续。')
    const tab = await chrome.tabs.create({ url, active: false })
    if (tab.id === undefined) throw new Error('申请页面未能打开。')
    return tab.id
  },
  focus: async id => { const tab = await chrome.tabs.update(id, { active: true }); if (tab?.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true }) },
  fill: async (job, queue) => {
    const deadline = Date.now() + 16_000
    let tab = await chrome.tabs.get(job.tabId!)
    while (tab.status !== 'complete' && Date.now() < deadline) { await new Promise(resolve => setTimeout(resolve, 400)); tab = await chrome.tabs.get(job.tabId!) }
    if (tab.status !== 'complete') throw new Error('页面加载较慢，请稍后继续，原标签页会保留。')
    const origin = new URL(tab.url ?? '').origin
    // A redirect does not grant permission for a new site. The popup asks for
    // that exact origin before the user can continue.
    if (!origin.startsWith('https://') || ![new URL(job.url).origin, ...(job.authorizedOrigins ?? [])].includes(origin) || !(await chrome.permissions.contains({ origins: [origin + '/*'] }))) throw new Error('页面跳转到了新的站点。打开扩展，允许当前申请页面后继续。')
    await chrome.scripting.executeScript({ target: { tabId: job.tabId! }, files: ['form-content.js'] })
    const response = await chrome.tabs.sendMessage(job.tabId!, { type: 'fill-application', profile: queue.profile, answers: queue.answers, attachment: queue.attachment, scope: `${job.company}\n${job.role}` }, { frameId: 0 }) as { result?: FormResult; error?: string }
    if (!response.result) throw new Error(response.error || '没有收到填写结果，请稍后继续。')
    return response.result
  },
})
// Recovery runs once per service-worker lifetime, before accepting commands.
// MV3 listeners must be registered synchronously, even when storage is slow.
const recovered = storageReady.then(() => engine.recover()).then(() => null, () => new Error('扩展存储未能读取，请检查浏览器存储后重开扩展。'))
const commandSchema = z.object({ action: z.enum(['start', 'pause', 'resume-job', 'done', 'skip', 'clear']), id: z.string().optional(), profile: profileSchema.optional(), answers: z.array(answerSchema).max(80).optional(), authorizeCurrent: z.boolean().optional() })
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  const popup = sender.id === chrome.runtime.id && !sender.tab && sender.url === chrome.runtime.getURL('popup.html')
  const workbench = sender.id === chrome.runtime.id && !!sender.tab && isWorkbenchUrl(sender.url ?? '')
  if (!popup && !workbench) return
  void (async () => {
    const startupError = await recovered
    if (startupError) throw startupError
    if (message.type === 'ping') return { version: 1 }
    if (message.type === 'snapshot') return engine.snapshot()
    if (message.type === 'stage' && workbench) return engine.stage(websiteBatchSchema.parse(message.batch))
    if (message.type === 'focus' && popup) { await engine.focus(z.string().parse(message.id)); return engine.snapshot() }
    if (message.type === 'command' && popup) {
      const input = commandSchema.parse(message)
      let authorizedOrigin: string | undefined
      let reopen = false
      if (input.action === 'resume-job') {
        const snapshot = await engine.snapshot(); const job = snapshot?.jobs.find(item => item.id === input.id)
        if (job?.tabId !== undefined && input.authorizeCurrent) {
          const tab = await chrome.tabs.get(job.tabId).catch(() => null)
          if (!tab) reopen = true
          else {
            const url = new URL(tab.url ?? '')
            if (url.protocol !== 'https:' || !(await chrome.permissions.contains({ origins: [url.origin + '/*'] }))) throw new Error('请先允许访问当前申请页面。')
            authorizedOrigin = url.origin
          }
        }
        if (input.answers?.some(answer => answer.origin !== (authorizedOrigin ?? new URL(job?.url ?? '').origin) || answer.scope !== `${job?.company}\n${job?.role}` || sensitiveField(answer.label))) throw new Error('这个问题请在官网填写。')
      }
      return engine.command(input.action, input.id, input.profile, input.answers, { authorizedOrigin, reopen })
    }
    throw new Error('请在扩展中开始或继续官网填写。')
  })().then(data => respond({ ok: true, data })).catch(error => respond({ ok: false, error: error instanceof z.ZodError ? '填写资料或岗位数据有误，请回工作台检查。' : error instanceof Error ? error.message : '操作失败。' }))
  return true
})
