type Input = { action: 'inspect' | 'contact' | 'open-chat' | 'receipts' | 'confirm-image'; assetUrls?: string[]; expectedRecipientKey?: string; expectedJobUrl?: string }
type DeliveryGuard = { interrupted: boolean; recipients?: WeakMap<HTMLElement, string>; contactChat?: string }

/** Image-only picker: attachment pickers that also accept documents are not chat images. */
export function findBossImageInput() {
  const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="file"]')].filter(node => {
    const accepts = node.accept.toLowerCase().split(',').map(value => value.trim()).filter(Boolean)
    return !node.disabled && accepts.length > 0 && accepts.every(value => /^image\/(?:\*|png|gif|jpe?g|webp)$/.test(value) || /^\.(?:png|gif|jpe?g|webp)$/.test(value))
  })
  if (inputs.length !== 1) throw new Error('图片上传入口不唯一，未上传')
  return inputs[0]
}
/** Fixed DOM operations for a batch-owned page. Never called by a read-only endpoint. */
export async function bossDeliveryDom(input: Input) {
  if (location.origin !== 'https://www.zhipin.com') throw new Error('会话已离开 BOSS，已停止')
  const owner = window as unknown as { __resumeGrillBatchGuard?: DeliveryGuard }
  if (!owner.__resumeGrillBatchGuard) {
    const guard: DeliveryGuard = owner.__resumeGrillBatchGuard = { interrupted: false }
    for (const kind of ['pointerdown', 'keydown']) addEventListener(kind, event => { if (event.isTrusted) guard.interrupted = true }, true)
  }
  const guard = owner.__resumeGrillBatchGuard
  if (guard.interrupted) throw new Error('检测到用户接管本批页面，已暂停，请核对当前会话')
  const visible = (node: Element) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'
  const enabled = (node: Element) => !node.hasAttribute('disabled') && node.getAttribute('aria-disabled') !== 'true' && !node.classList.contains('disabled') && getComputedStyle(node).pointerEvents !== 'none'
  const norm = (text: string) => text.trim().replace(/\s+/g, ' ')
  const notices = [...document.querySelectorAll<HTMLElement>('.dialog-wrap, .toast, .toast-content, .verify-wrap, .geetest_panel')].filter(visible).map(node => node.innerText).join(' ')
  if (/安全验证|验证码|沟通.*上限|操作.*频繁|明天再试|购买|立即开通/.test(notices)) throw new Error('官网要求验证、达到沟通限制或出现付费提示，已暂停')
  const editors = [...document.querySelectorAll<HTMLElement>('#chat-input, .chat-input[contenteditable="true"], .chat-editor textarea, .startchat-dialog textarea, .dialog-wrap textarea')].filter(visible)
  const sendButtons = [...document.querySelectorAll<HTMLElement>('button, .btn-send, .send-message')].filter(node => visible(node) && norm(node.innerText) === '发送')
  const send = sendButtons.filter(enabled)
  const imagePreviews = [...document.querySelectorAll('.image-preview img, .picture-preview img, .chat-editor .img-preview img')].filter(visible)
  const contact = [...document.querySelectorAll<HTMLElement>('a, button, .btn-startchat')].filter(node => visible(node) && enabled(node) && /^(立即沟通|继续沟通)$/.test(norm(node.innerText)))
  const chatDestination = (value: string | null | undefined) => {
    if (!value) return undefined
    try {
      const url = new URL(value, location.origin)
      const job = location.pathname.match(/^\/job_detail\/([^/]+)\.html$/)?.[1]
      if (job && url.origin === location.origin && url.pathname === '/web/geek/chat' && !url.username && !url.password && !url.hash && url.searchParams.get('id') && url.searchParams.get('jobId') === job) return url.href
    } catch { /* Ignore malformed destinations. */ }
  }
  const chats = [...new Set(contact.flatMap(node => {
    const url = chatDestination(node.getAttribute('redirect-url'))
    return url ? [url] : []
  }))]
  const captured = chatDestination(guard.contactChat)
  const destination = chats.length === 1 && (!captured || new URL(chats[0]).searchParams.get('id') === new URL(captured).searchParams.get('id'))
    ? chats[0]
    : chats.length === 0 ? captured : undefined
  const outgoing = [...document.querySelectorAll<HTMLElement>('.chat-message-self, .message-self, .message-item.is-self, .message-item.sent, .message-item.item-my, .message-item.item-myself, .message-item.role-geek, .message-item.item-me, .message-list .item-me')].filter(node => visible(node) && !node.matches('.sending, .failed, .send-failed') && !node.querySelector('.send-fail, .message-fail, .send-error, .message-status.loading'))
  const outgoingTexts = outgoing.flatMap((node, index) => {
    const content = node.querySelector<HTMLElement>('.message-content .text-content, .message-content .msg-content') ?? node.querySelector<HTMLElement>('.message-content .text') ?? node.querySelector<HTMLElement>('.message-content, .msg-content, .text-content, .text') ?? node
    const text = content.innerText.trim()
    return text ? [{ id: node.getAttribute('data-mid') || node.getAttribute('data-message-id') || `text:${index}`, text, delivered: !!node.querySelector('.message-status.status-delivery, .message-status.status-read') }] : []
  })
  const images = outgoing.flatMap(node => [...node.querySelectorAll<HTMLImageElement>('img')]).filter(node => node.complete && node.naturalWidth > 0).map(node => node.currentSrc || node.src)
  const jobLinks = [...document.querySelectorAll<HTMLAnchorElement>('.chat-header a[href*="/job_detail/"], .chat-job-info a[href*="/job_detail/"], .chat-job-card a[href*="/job_detail/"]')].map(node => { const url = new URL(node.href); return url.origin + url.pathname })
  const modern = [...document.querySelectorAll<HTMLElement>('.friend-content.selected')].filter(visible)
  const selected = modern.length ? modern : [...document.querySelectorAll<HTMLElement>('.recruit-chat-item.active, .chat-item.active, .chat-list-item.active, .user-item.active, .user-item.selected, .user-list .active')].filter(visible)
  const recipients = guard.recipients ??= new WeakMap()
  const identities = selected.length === 1 ? selected.map(node => {
    // Bind to the actual list item, not just a possibly duplicated recruiter name.
    // Replacing/recycling the item or changing its visible identity invalidates it.
    let key = recipients.get(node)
    if (!key) { key = crypto.randomUUID(); recipients.set(node, key) }
    return [key, node.dataset.bossId, node.dataset.uid, node.dataset.id,
      node.querySelector<HTMLElement>('.title-box, .name-text, .name, .user-name, .nick-name')?.innerText,
      node.querySelector<HTMLImageElement>('img')?.getAttribute('src')].filter(Boolean).join(':')
  }) : []
  const params = new URL(location.href).searchParams
  const urlIds = ['bossId', 'encryptBossId', 'friendId', 'uid'].flatMap(key => params.has(key) ? [key + ':' + params.get(key)] : [])
  const identity = selected.length > 1 ? '' : [...identities, ...urlIds].join('|')
  const recipientKey = identity ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity))), byte => byte.toString(16).padStart(2, '0')).join('') : ''
  if (guard.interrupted) throw new Error('检测到用户接管本批页面，已暂停，请核对当前会话')
  if ((input.expectedRecipientKey && recipientKey !== input.expectedRecipientKey) || (input.expectedJobUrl && location.origin + location.pathname !== input.expectedJobUrl)) throw new Error('发送前会话身份已变化，未点击发送')
  if (input.action === 'contact') {
    if (contact.length !== 1) throw new Error('沟通入口不唯一，未点击')
    if (norm(contact[0].innerText) === '继续沟通') throw new Error('官网显示已沟通过，未再次联系')
    // The site's inline composer can remove or disable this button after contact.
    guard.contactChat = chatDestination(contact[0].getAttribute('redirect-url'))
    contact[0].click()
  }
  if (input.action === 'open-chat') {
    if (!input.expectedJobUrl || !destination) throw new Error('未识别到当前岗位的唯一沟通页面，未跳转')
    // Follow the website's own destination. This only opens a conversation;
    // unlike clicking "立即沟通" again it never repeats friend/add or a greeting.
    location.assign(destination)
  }
  if (input.action === 'confirm-image') {
    if (imagePreviews.length !== 1) throw new Error('未识别到唯一图片预览，不能确认发送')
    const preview = imagePreviews[0].closest('.image-preview, .picture-preview, .img-preview')
    const scope = preview?.closest('dialog, [role="dialog"], .dialog-wrap, .chat-editor') ?? preview
    const buttons = send.filter(button => scope?.contains(button))
    const hasDraft = editors.some(editor => scope?.contains(editor) && norm(editor instanceof HTMLTextAreaElement ? editor.value : editor.innerText))
    if (buttons.length !== 1 || hasDraft) throw new Error('未识别到图片专用的发送入口')
    buttons[0].click()
  }
  const verifiedImages: string[] = []
  if (input.action === 'receipts' && input.assetUrls?.length) {
    for (const src of images) {
      const url = new URL(src)
      if (input.assetUrls.some(asset => { try { const value = new URL(asset); return value.origin === url.origin && value.pathname === url.pathname } catch { return false } })) verifiedImages.push(src)
    }
  }
  return { url: location.origin + location.pathname, recipientKey, editors: editors.length, sendButtons: sendButtons.length, canOpenChat: !!destination, outgoingTexts, images, imagePreviews: imagePreviews.length, verifiedImages, jobLinks }
}
