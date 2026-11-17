import type { BossComposerState, BossDraftResult } from '../domain/boss-draft.ts'
type Operation = { action: 'inspect'; jobUrl?: string } | { action: 'test'; text: string; clear: boolean } | { action: 'fill'; text: string; expected: BossComposerState; jobUrl?: string }
/** One serialized implementation shared by inspection, tests and reviewed local drafts. */
export async function runBossComposer(input: Operation): Promise<BossComposerState | BossDraftResult> {
  const jobUrl = 'jobUrl' in input ? input.jobUrl : undefined
  const chat = location.hostname === 'www.zhipin.com' && (/^\/web\/geek\/chat\/?$/.test(location.pathname) || !!jobUrl && location.origin + location.pathname === jobUrl)
  const nodes = chat ? [...document.querySelectorAll<HTMLElement>('textarea, [contenteditable="true"]')].filter(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden') : []
  const conversation = chat ? [...document.querySelectorAll<HTMLElement>('.friend-content.selected .title-box, .user-item.active, .user-item.selected, .user-list .active, .chat-list .active, .chat-user-list .active, .chat-header .name, .chat-info .name, .chat-title')].filter(node => node.getClientRects().length > 0).map(node => node.innerText.trim()).filter(Boolean).join('\n').slice(0, 500) : ''
  const selected = chat ? [...document.querySelectorAll<HTMLElement>('.friend-content.selected, .user-item.active, .user-item.selected')].filter(node => node.getClientRects().length > 0) : []
  let conversationKey: string | undefined
  if (selected.length === 1) {
    const owner = window as unknown as { __resumeGrillDraftRecipients?: WeakMap<HTMLElement, string> }
    const identities = owner.__resumeGrillDraftRecipients ??= new WeakMap()
    conversationKey = identities.get(selected[0])
    if (!conversationKey) { conversationKey = crypto.randomUUID(); identities.set(selected[0], conversationKey) }
  }
  const state: BossComposerState = { chat, conversation, ...(conversationKey ? { conversationKey } : {}), fields: nodes.map(node => ({ tag: node.tagName, id: node.id, className: node.className, role: node.getAttribute('role'), placeholder: node.getAttribute('placeholder') || node.getAttribute('data-placeholder'), editable: !node.hasAttribute('disabled') && !node.hasAttribute('readonly'), empty: !(node instanceof HTMLTextAreaElement ? node.value : node.innerText).trim(), ancestors: [node.parentElement?.className, node.parentElement?.parentElement?.className] })) }
  if (input.action === 'inspect') return state
  if (!chat) throw new Error('请在 Chrome 手动打开对应的已有会话，再检查输入框。')
  if (!input.text.trim() || input.text.length > 1000) throw new Error('招呼语应为 1–1000 字')
  if (input.action === 'test' && !input.text.startsWith('【填写测试，请勿发送】')) throw new Error('只允许带测试标记的短文本')
  if (input.action === 'fill' && JSON.stringify(state) !== JSON.stringify(input.expected)) throw new Error('会话或输入框已变化，请重新核对。')
  const candidates = nodes.filter(node => node.matches('.chat-input, #chat-input, .chat-input textarea, .chat-input [contenteditable="true"], .chat-editor [contenteditable="true"], .chat-conversation textarea, .chat-conversation [contenteditable="true"], .startchat-dialog textarea, .dialog-wrap textarea') && !node.hasAttribute('disabled') && !node.hasAttribute('readonly'))
  if (candidates.length !== 1) throw new Error('未能唯一识别已有会话的输入框，未填写')
  const node = candidates[0]
  const value = () => node instanceof HTMLTextAreaElement ? node.value : node.innerText
  if (value().trim()) throw new Error('输入框已有草稿，未覆盖')
  const set = (text: string) => {
    if (node instanceof HTMLTextAreaElement) Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(node, text)
    else node.textContent = text
    node.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }))
  }
  set(input.text)
  await new Promise(resolve => setTimeout(resolve, 400))
  const written = node.isConnected && value() === input.text
  const clear = input.action === 'test' && input.clear
  if (clear && written) { set(''); await new Promise(resolve => setTimeout(resolve, 200)) }
  return { written, cleared: clear && value() === '', characters: input.text.length, sendActionPerformed: false }
}
export async function inspectBossComposer() { return await runBossComposer({ action: 'inspect' }) as BossComposerState }
export async function testBossComposer(input: { text: string; clear: boolean }) { return await runBossComposer({ action: 'test', ...input }) as BossDraftResult }

/** Structural diagnostics only: no message text, contacts, cookies or URL parameters. */
export function inspectBossComposerDocument() {
  const visible = (node: Element) => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden'
  const controls = (doc: Document) => [...doc.querySelectorAll<HTMLElement>('textarea,[contenteditable="true"]')].map(node => ({ tag: node.tagName, id: node.id, visible: visible(node), editable: !node.hasAttribute('disabled') && !node.hasAttribute('readonly') }))
  const address = (value: string) => { try { const url = new URL(value, location.href); return url.origin === location.origin ? url.origin + url.pathname : '[其他站点]' } catch { return '[未知地址]' } }
  return {
    url: address(location.href), readyState: document.readyState, visibility: document.visibilityState,
    fields: controls(document),
    frames: [...document.querySelectorAll('iframe')].slice(0, 10).map(frame => {
      let doc: Document | null = null
      try { doc = frame.contentDocument } catch { /* Cross-origin contents remain unread. */ }
      return { url: address(frame.src), visible: visible(frame), accessible: !!doc, readyState: doc?.readyState, fields: doc ? controls(doc) : [] }
    }),
  }
}
