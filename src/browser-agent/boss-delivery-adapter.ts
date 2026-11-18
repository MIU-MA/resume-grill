import { createHash } from 'node:crypto'
import type { BrowserTask, BrowserStep } from '../domain/browser-application.ts'
import type { BrowserDeliveryAdapter } from './application-queue.ts'
import type { BossBrowserReader } from './boss-reader.ts'
import { inspectBossDetail } from './boss-inspection.ts'
import { bossDeliveryDom } from './boss-delivery-dom.ts'

type Page = Parameters<Parameters<BossBrowserReader['withJobPage']>[2]>[0]
export function createBossDeliveryAdapter(browser: BossBrowserReader, source: Page, files: Map<string, string>, claimContact: (url: string) => Promise<void>) {
  let jobPage: Page | undefined, chat: Page | undefined, release: (() => void) | undefined, held: Promise<unknown> | undefined
  let contactVerified = false
  let currentUrl = ''
  let recipientKey = ''
  let beforeContact = new Set<string>()
  const receipts = new Map<string, { id: string; value: string }>()
  const wait = async <T>(check: () => Promise<T | undefined>, message: string, timeout = 10000) => {
    const end = Date.now() + timeout
    while (Date.now() < end) { const value = await check(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 200)) }
    throw new Error(message)
  }
  const closePage = async () => {
    if (chat && chat !== jobPage) await browser.closeOwnedPage(chat).catch(() => {})
    release?.(); await held?.catch(() => {}); jobPage = chat = undefined; release = undefined; held = undefined
  }
  const active = () => { if (!chat || chat.isClosed()) throw new Error('本批会话页面已关闭'); return chat }
  const inspectConversation = async () => {
    try { return await active().evaluate(bossDeliveryDom, { action: 'inspect' }) }
    catch (error) {
      // Navigation can replace the document while a read is in flight.
      if (error instanceof Error && /execution context was destroyed|cannot find (?:default )?context/i.test(error.message)) return undefined
      throw error
    }
  }
  const openConversation = async (task: BrowserTask) => {
    await active().evaluate(bossDeliveryDom, { action: 'open-chat', expectedJobUrl: task.url })
    const state = await wait(async () => {
      const state = await inspectConversation()
      if (!state) return
      if (state.jobLinks.some(url => url !== task.url)) throw new Error('沟通页的岗位链接不一致，已停止')
      return state.url === 'https://www.zhipin.com/web/geek/chat' && state.editors === 1 && state.sendButtons === 1 && !!state.recipientKey ? state : undefined
    }, '完整沟通页未就绪，未再次点击沟通', 20000)
    recipientKey = state.recipientKey; contactVerified = true
    return state
  }
  const adapter: BrowserDeliveryAdapter = {
    async open(task) {
      await closePage(); contactVerified = false; recipientKey = ''; beforeContact = new Set(); currentUrl = task.url
      const previouslyContacted = task.steps.some(step => step.kind === 'contact' && step.state === 'verified' && step.receipt === `contact:${task.url}`)
      let opened!: () => void, rejected!: (error: unknown) => void
      const ready = new Promise<void>((resolve, reject) => { opened = resolve; rejected = reject })
      held = browser.withJobPage(task.url, source, async page => {
        jobPage = chat = page
        let reason = '岗位详情身份或完整 JD 未核对通过，未联系招聘方'
        await wait(async () => {
          const detail = await inspectBossDetail(page, { url: task.url, title: task.title, company: task.company })
          reason = detail.blockers.join(' ') || reason
          if (detail.matched && detail.communication.labels.includes('继续沟通') && !previouslyContacted) { reason = '官网显示已沟通过，未再次联系，请在已有会话处理'; throw new Error(reason) }
          if (detail.kind === 'login' || detail.kind === 'verification') throw new Error(detail.blockers.join(' '))
          return detail.matched && !detail.blockers.length ? true : undefined
        }, '岗位详情未核对通过').catch(() => { throw new Error(reason) })
        opened(); await new Promise<void>(resolve => { release = resolve })
      }).catch(error => { rejected(error); throw error })
      void held.catch(() => {})
      await ready
      if (previouslyContacted) await openConversation(task)
    },
    async checkRecipient(task) {
      if (task.url !== currentUrl || !chat || chat.isClosed()) return false
      const state = await chat.evaluate(bossDeliveryDom, { action: 'inspect' })
      if (state.jobLinks.some(url => url !== task.url)) return false
      return contactVerified ? state.editors === 1 && (state.url === task.url || !!recipientKey && state.recipientKey === recipientKey) : state.url === task.url
    },
    async send(task, step) {
      if (step.kind === 'contact') {
        beforeContact = new Set((await active().evaluate(bossDeliveryDom, { action: 'inspect' })).outgoingTexts.map(message => message.id))
        await claimContact(task.url)
        await active().evaluate(bossDeliveryDom, { action: 'contact', expectedJobUrl: task.url })
        const verified = await wait(async () => {
          const popup = jobPage ? await browser.ownedChatPopup(jobPage) : undefined
          if (popup) chat = popup
          const state = await inspectConversation()
          if (!state) return
          if (state.jobLinks.some(url => url !== task.url)) throw new Error('沟通页的岗位链接不一致，已停止')
          if (state.url === task.url && state.editors === 1 && state.canOpenChat) {
            return openConversation(task)
          }
          return state.editors === 1 && state.sendButtons === 1 && (state.url === task.url || !!state.recipientKey) ? state : undefined
        }, '点击沟通后未能核对会话，结果待核对，不会重新点击')
        recipientKey = verified.recipientKey; contactVerified = true; receipts.set(step.id, { id: `contact:${task.url}`, value: task.url }); return
      }
      if (step.kind === 'greeting') {
        throw new Error('BOSS 批次不追加自定义招呼语，只核对官网自动招呼')
      }
      const file = files.get(step.value)
      if (!file) throw new Error('已核对的简历图片不存在')
      const page = active(), assets: string[] = []
      const response = async (value: { url(): string; status(): number; json(): Promise<unknown> }) => {
        if (!/upload|image|picture/i.test(new URL(value.url()).pathname) || value.status() !== 200) return
        try {
          const body = await value.json() as { code?: number; zpData?: { url?: string; imageUrl?: string }; data?: { url?: string } }
          if (body.code !== 0) return
          for (const url of [body.zpData?.url, body.zpData?.imageUrl, body.data?.url]) if (url && new URL(url).protocol === 'https:') assets.push(url)
        } catch { /* An unreadable upload result is not success. */ }
      }
      page.on('response', response)
      try {
        if (!await adapter.checkRecipient(task)) throw new Error('上传前会话已变化，未上传图片')
        const baseline = await page.evaluate(bossDeliveryDom, { action: 'receipts' })
        if (baseline.imagePreviews) throw new Error('会话已有待发送的图片，请先处理原草稿')
        const before = new Set(baseline.images)
        await page.attachImage(file)
        let confirmTried = false
        const id = await wait(async () => {
          const state = await page.evaluate(bossDeliveryDom, { action: 'receipts', assetUrls: assets })
          const uploaded = state.verifiedImages.find(url => !before.has(url))
          if (uploaded) return uploaded
          // Local blob bytes only prove that a preview exists. Require a successful
          // upload response AND a new outgoing image matching its returned URL.
          if (!confirmTried && Date.now() - began > 1000) {
            confirmTried = true
            // No thumbnail is normal for auto-send image inputs. Never retry file injection.
            await page.evaluate(bossDeliveryDom, { action: 'confirm-image', ...(recipientKey ? { expectedRecipientKey: recipientKey } : { expectedJobUrl: task.url }) }).catch(() => undefined)
          }
          return undefined
        }, '图片未获得发送回执，可能已上传；已停止，不能自动重发', 12000)
        receipts.set(step.id, { id: createHash('sha256').update(id).digest('hex'), value: step.value })
      } finally { page.removeListener('response', response) }
    },
    async resolveGreeting(task) {
      let observed = '尚未读到会话消息'
      const message = await wait(async () => {
        if (!await adapter.checkRecipient(task)) throw new Error('自动招呼核对前会话已变化')
        const state = await active().evaluate(bossDeliveryDom, { action: 'receipts' })
        const added = state.outgoingTexts.filter(value => !beforeContact.has(value.id) && !value.id.startsWith('text:') && value.delivered)
        observed = `读到 ${state.outgoingTexts.length} 条己方消息，${added.length} 条新增且已送达`
        if (added.length > 1) throw new Error('出现多条自动消息，已暂停，不追加文字')
        return added[0]
      }, '未确认官网自动招呼回执，已暂停，不补发自定义文字', 30000).catch(error => {
        throw new Error(`${error instanceof Error ? error.message : '自动招呼核对失败'}（${observed}）`)
      })
      return { id: message.id, value: message.text }
    },
    async receipt(_task: BrowserTask, step: BrowserStep) { return receipts.get(step.id) ?? null },
  }
  let began = 0
  const send = adapter.send
  adapter.send = async (task, step) => { began = Date.now(); await send(task, step) }
  return { adapter, close: closePage, currentPage: () => chat }
}
