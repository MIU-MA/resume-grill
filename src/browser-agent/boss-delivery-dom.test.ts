// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { bossDeliveryDom, findBossImageInput } from './boss-delivery-dom'
const url = 'https://www.zhipin.com/job_detail/fixture.html'
beforeEach(() => {
  vi.stubGlobal('location', { origin: 'https://www.zhipin.com', pathname: '/job_detail/fixture.html', href: url })
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
  Object.defineProperty(HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent ?? '' } })
  document.body.innerHTML = '<div class="chat-editor"><textarea>已核对的招呼语</textarea><button>发送</button></div>'
})
afterEach(() => { document.body.innerHTML = ''; delete (HTMLElement.prototype as unknown as Record<string, unknown>).innerText; vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('只发送与核对文本一致的内容，重复正文不再点击', async () => {
  const send = vi.fn(); document.querySelector('button')!.onclick = send
  await bossDeliveryDom({ action: 'send', text: '已核对的招呼语', expectedJobUrl: url })
  expect(send).toHaveBeenCalledTimes(1)
  document.body.insertAdjacentHTML('beforeend', '<div class="chat-message-self" data-mid="1"><span class="message-content">已核对的招呼语</span></div>')
  await expect(bossDeliveryDom({ action: 'send', text: '已核对的招呼语' })).rejects.toThrow('避免重复')
  expect(send).toHaveBeenCalledTimes(1)
})
it('会话变化、内容被改动或官网提示限制时都不点击', async () => {
  const send = vi.fn(); document.querySelector('button')!.onclick = send
  await expect(bossDeliveryDom({ action: 'send', text: '已核对的招呼语', expectedRecipientKey: 'other-recipient' })).rejects.toThrow('身份已变化')
  await expect(bossDeliveryDom({ action: 'send', text: '另一段正文' })).rejects.toThrow('不一致')
  document.body.insertAdjacentHTML('beforeend', '<div class="dialog-wrap">今日沟通已达上限</div>')
  await expect(bossDeliveryDom({ action: 'send', text: '已核对的招呼语' })).rejects.toThrow('已暂停')
  expect(send).not.toHaveBeenCalled()
})
it('不把失败或发送中的气泡当作有效回执，也不把空输入时的禁用按钮当作缺失', async () => {
  document.querySelector('button')!.disabled = true
  document.body.insertAdjacentHTML('beforeend', '<div class="chat-message-self failed">已核对的招呼语</div><div class="chat-message-self"><span>已核对的招呼语</span><span class="send-fail"></span></div>')
  expect(await bossDeliveryDom({ action: 'receipts', text: '已核对的招呼语' })).toMatchObject({ sendButtons: 1, texts: [] })
  await expect(bossDeliveryDom({ action: 'send', text: '已核对的招呼语' })).rejects.toThrow('未发送')
})

it('真实页面的图片入口与 PDF/Word 附件入口分开，多个图片入口拒绝猜测', () => {
  document.body.innerHTML = '<input id="image" type="file" accept="image/gif,image/jpeg,image/jpg,image/png"><input type="file" accept="image/png,application/pdf,.doc,.docx"><input type="file" accept="image/jpeg,.pdf">'
  expect(findBossImageInput().id).toBe('image')
  document.body.insertAdjacentHTML('beforeend', '<input type="file" accept="image/*">')
  expect(() => findBossImageInput()).toThrow('不唯一')
})

it('识别真实 item-myself 气泡，不包含时间及已读状态，不把对方消息作为回执', async () => {
  document.body.insertAdjacentHTML('beforeend', '<li class="message-item item-friend"><div class="message-content">已核对的招呼语</div></li><li class="message-item item-myself" data-mid="real-style"><div class="item-time">10:00</div><div class="message-content"><span class="text">已核对的招呼语</span><span>已读</span></div></li>')
  expect((await bossDeliveryDom({ action: 'receipts', text: '已核对的招呼语' })).texts).toEqual(['real-style'])
})

it('同名会话不能共用身份，最后一条消息变化不使身份变化', async () => {
  document.body.insertAdjacentHTML('beforeend', '<div class="friend-content selected"><div class="title-box"><span class="name-text">王先生 · 示例公司</span></div><div class="last-msg">旧消息</div></div><div class="friend-content"><div class="title-box"><span class="name-text">王先生 · 示例公司</span></div></div>')
  const first = await bossDeliveryDom({ action: 'inspect', text: '' })
  expect(first.recipientKey).not.toBe('')
  document.querySelector('.last-msg')!.textContent = '新消息'
  expect((await bossDeliveryDom({ action: 'inspect', text: '' })).recipientKey).toBe(first.recipientKey)
  const items = document.querySelectorAll('.friend-content')
  items[0].classList.remove('selected'); items[1].classList.add('selected')
  await expect(bossDeliveryDom({ action: 'send', text: '已核对的招呼语', expectedRecipientKey: first.recipientKey })).rejects.toThrow('身份已变化')
})
