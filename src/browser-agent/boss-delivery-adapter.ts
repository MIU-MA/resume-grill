import { createHash } from 'node:crypto'
import type { BrowserTask, BrowserStep } from '../domain/browser-application.ts'
import type { BrowserDeliveryAdapter } from './application-queue.ts'
import type { BossBrowserReader } from './boss-reader.ts'
import { inspectBossDetail } from './boss-inspection.ts'
import { runBossComposer } from './boss-composer.ts'
import type { BossComposerState } from '../domain/boss-draft.ts'
import { bossDeliveryDom } from './boss-delivery-dom.ts'

type Page = Parameters<Parameters<BossBrowserReader['withJobPage']>[2]>[0]
export function createBossDeliveryAdapter(browser: BossBrowserReader, source: Page, files: Map<string, string>) {
  let jobPage: Page | undefined, chat: Page | undefined, release: (() => void) | undefined, held: Promise<unknown> | undefined
  let contactVerified = false
  let currentUrl = ''
  let recipientKey = ''
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
  const adapter: BrowserDeliveryAdapter = {
    async open(task) {
      await closePage(); contactVerified = false; recipientKey = ''; currentUrl = task.url
      let opened!: () => void, rejected!: (error: unknown) => void
      const ready = new Promise<void>((resolve, reject) => { opened = resolve; rejected = reject })
      held = browser.withJobPage(task.url, source, async page => {
        jobPage = chat = page
        let reason = '岗位详情身份或完整 JD 未核对通过，未联系招聘方'
        await wait(async () => {
          const detail = await inspectBossDetail(page, { url: task.url, title: task.title, company: task.company })
          reason = detail.blockers.join(' ') || reason
          if (detail.kind === 'login' || detail.kind === 'verification') throw new Error(detail.blockers.join(' '))
          return detail.matched && !detail.blockers.length ? true : undefined
        }, '岗位详情未核对通过').catch(() => { throw new Error(reason) })
        opened(); await new Promise<void>(resolve => { release = resolve })
      }).catch(error => { rejected(error); throw error })
      void held.catch(() => {})
      await ready
    },
    async checkRecipient(task) {
      if (task.url !== currentUrl || !chat || chat.isClosed()) return false
      const state = await chat.evaluate(bossDeliveryDom, { action: 'inspect', text: '' })
      if (state.jobLinks.some(url => url !== task.url)) return false
      return contactVerified ? state.editors === 1 && (state.url === task.url || !!recipientKey && state.recipientKey === recipientKey) : state.url === task.url
    },
    async send(task, step) {
      if (step.kind === 'contact') {
        await active().evaluate(bossDeliveryDom, { action: 'contact', text: '' })
        const verified = await wait(async () => {
          const popup = jobPage ? await browser.ownedChatPopup(jobPage) : undefined
          if (popup) chat = popup
          const state = await active().evaluate(bossDeliveryDom, { action: 'inspect', text: '' })
          if (state.jobLinks.some(url => url !== task.url)) throw new Error('沟通页的岗位链接不一致，已停止')
          return state.editors === 1 && state.sendButtons === 1 && (state.url === task.url || !!state.recipientKey) ? state : undefined
        }, '点击沟通后未能核对会话，结果待核对，不会重新点击')
        recipientKey = verified.recipientKey; contactVerified = true; receipts.set(step.id, { id: `contact:${task.url}`, value: task.url }); return
      }
      if (step.kind === 'greeting') {
        const page = active()
        const state = await page.evaluate(runBossComposer, { action: 'inspect', jobUrl: task.url }) as BossComposerState
        const written = await page.evaluate(runBossComposer, { action: 'fill', text: step.value, expected: state, jobUrl: task.url })
        if (!('written' in written) || !written.written) throw new Error('招呼语未能保留，未点击发送')
        await page.evaluate(bossDeliveryDom, { action: 'send', text: step.value, ...(recipientKey ? { expectedRecipientKey: recipientKey } : { expectedJobUrl: task.url }) })
        const id = await wait(async () => (await page.evaluate(bossDeliveryDom, { action: 'receipts', text: step.value })).texts[0], '未获得招呼语的发送回执，结果待核对')
        receipts.set(step.id, { id, value: step.value }); return
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
        const before = new Set((await page.evaluate(bossDeliveryDom, { action: 'receipts', text: '' })).images)
        await page.attachImage(file)
        let confirmTried = false
        const id = await wait(async () => {
          const state = await page.evaluate(bossDeliveryDom, { action: 'receipts', text: '', assetUrls: assets })
          const uploaded = state.verifiedImages.find(url => !before.has(url))
          if (uploaded) return uploaded
          // Some pages expose a local blob until upload completes. Verify its actual bytes.
          for (const url of state.images.filter(value => value.startsWith('blob:') && !before.has(value))) {
            const hash = await page.evaluate(async value => { const data = await (await fetch(value)).arrayBuffer(); return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), byte => byte.toString(16).padStart(2, '0')).join('') }, url)
            if (hash === step.value) return `image:${hash}`
          }
          if (!confirmTried && Date.now() - began > 1000) {
            confirmTried = true
            // No thumbnail is normal for auto-send image inputs. Never retry file injection.
            await page.evaluate(bossDeliveryDom, { action: 'confirm-image', text: '', ...(recipientKey ? { expectedRecipientKey: recipientKey } : { expectedJobUrl: task.url }) }).catch(() => undefined)
          }
          return undefined
        }, '图片未获得发送回执，可能已上传；已停止，不能自动重发', 12000)
        receipts.set(step.id, { id: createHash('sha256').update(id).digest('hex'), value: step.value })
      } finally { page.removeListener('response', response) }
    },
    async receipt(_task: BrowserTask, step: BrowserStep) { return receipts.get(step.id) ?? null },
  }
  let began = 0
  const send = adapter.send
  adapter.send = async (task, step) => { began = Date.now(); await send(task, step) }
  return { adapter, close: closePage, currentPage: () => chat }
}
