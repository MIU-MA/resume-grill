import { z } from 'zod'
import { attachmentSchema, sourceUrlSchema } from '../domain/mail-schema'
import { profileSchema, type FormResult } from '../domain/website-automation'

export const directDataSchema = z.object({ profile: profileSchema, attachment: attachmentSchema.nullable().default(null) }).strict()
export type DirectData = z.infer<typeof directDataSchema>
export type DirectRun = { url: string; status: 'running' | 'done' | 'error'; result?: FormResult; error?: string }
export type DirectState = DirectData & { run?: DirectRun }
export const DIRECT_KEY = 'website-direct-fill:v1'
const requestSchema = z.object({ tabId: z.number().int().nonnegative(), url: sourceUrlSchema, data: directDataSchema }).strict()

export function createDirectFill() {
  let running = false
  let writes = Promise.resolve()
  const write = (work: () => Promise<void>) => {
    const next = writes.then(work)
    writes = next.catch(() => undefined)
    return next
  }
  const read = async (): Promise<DirectState> => {
    const stored = await chrome.storage.local.get([DIRECT_KEY, 'website-queue:v1'])
    if (stored[DIRECT_KEY]) return stored[DIRECT_KEY] as DirectState
    const batch = stored['website-queue:v1'] as { profile?: unknown; attachment?: unknown } | undefined
    const previous = directDataSchema.safeParse({ profile: batch?.profile ?? {}, attachment: batch?.attachment ?? null })
    return previous.success ? previous.data : { profile: {}, attachment: null }
  }
  const get = async () => {
    await writes
    const state = await read()
    if (state.run?.status === 'running' && !running) return { ...state, run: { ...state.run, status: 'error' as const, error: '上次填写被中断，请核对官网后再次点击填写。' } }
    return state
  }
  const save = async (input: unknown) => {
    const data = directDataSchema.parse(input)
    await write(async () => { const old = await read(); await chrome.storage.local.set({ [DIRECT_KEY]: { ...old, ...data } }) })
    return get()
  }
  const fill = async (input: unknown): Promise<DirectState> => {
    const request = requestSchema.parse(input)
    if (running) throw new Error('正在填写，请等这一轮完成。')
    if (!Object.values(request.data.profile).some(Boolean) && !request.data.attachment) throw new Error('先填写一项个人资料，或选择简历附件。')
    running = true
    const setRun = (run: DirectRun) => write(async () => { const old = await read(); await chrome.storage.local.set({ [DIRECT_KEY]: { ...old, run } }) })
    try {
      const tab = await chrome.tabs.get(request.tabId)
      if (tab.url !== request.url) throw new Error('页面已经跳转，请重新打开扩展再填写。')
      if (!await chrome.permissions.contains({ origins: [new URL(request.url).origin + '/*'] })) throw new Error('尚未允许访问当前官网，请再次点击填写并允许访问。')
      await save(request.data)
      await setRun({ url: request.url, status: 'running' })
      const injected = await chrome.scripting.executeScript({ target: { tabId: request.tabId, frameIds: [0] }, files: ['form-content.js'] })
      const documentId = injected.find(item => item.frameId === 0)?.documentId
      if (!documentId || (await chrome.tabs.get(request.tabId)).url !== request.url) throw new Error('申请页面已变化，请重新打开扩展再填写。')
      const response = await chrome.tabs.sendMessage(request.tabId, { type: 'fill-application', profile: request.data.profile, attachment: request.data.attachment, answers: [], scope: '', expectedUrl: request.url }, { documentId }) as { result?: FormResult; error?: string }
      if (!response?.result) throw new Error(response?.error || '页面没有返回填写结果，请核对官网后重试。')
      await setRun({ url: request.url, status: 'done', result: response.result })
    } catch (error) {
      await setRun({ url: request.url, status: 'error', error: error instanceof Error ? error.message : '填写失败，请核对官网后重试。' })
    } finally { running = false }
    return get()
  }
  return { get, save, fill }
}
