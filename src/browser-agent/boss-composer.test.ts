// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { inspectBossComposer, testBossComposer, runBossComposer, inspectBossComposerDocument } from './boss-composer'
const text = '【填写测试，请勿发送】你好，想了解这个岗位的工作内容。'
beforeEach(() => {
  vi.stubGlobal('location', { hostname: 'www.zhipin.com', pathname: '/web/geek/chat' })
  vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
  document.body.innerHTML = '<div class="chat-input"><textarea></textarea><button>发送</button></div>'
})
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('诊断只返回输入结构，不包含会话正文或查询参数', () => {
  vi.stubGlobal('location', new URL('https://www.zhipin.com/web/geek/chat?private=secret'))
  document.querySelector('textarea')!.value = '用户未发送的私人草稿'
  document.body.insertAdjacentHTML('beforeend', '<div class="chat-title">私人联系人</div>')
  const result = inspectBossComposerDocument()
  expect(result.fields).toEqual([{ tag: 'TEXTAREA', id: '', visible: true, editable: true }])
  expect(JSON.stringify(result)).not.toMatch(/私人|secret|private=/)
})
it('填入后读回并清除，不点击发送、不触发键盘快捷发送', async () => {
  const clicked = vi.fn(), keyed = vi.fn(), input = vi.fn()
  document.querySelector('button')!.onclick = clicked
  document.querySelector('textarea')!.onkeydown = keyed
  document.querySelector('textarea')!.oninput = input
  expect(await inspectBossComposer()).toMatchObject({ chat: true, fields: [{ empty: true, editable: true }] })
  expect(await testBossComposer({ text, clear: true })).toMatchObject({ written: true, cleared: true, sendActionPerformed: false })
  expect(document.querySelector('textarea')!.value).toBe('')
  expect(clicked).not.toHaveBeenCalled(); expect(keyed).not.toHaveBeenCalled(); expect(input).toHaveBeenCalledTimes(2)
})
it('已有草稿或多个输入框时不碰用户内容', async () => {
  document.querySelector('textarea')!.value = '用户原草稿'
  await expect(testBossComposer({ text, clear: true })).rejects.toThrow('已有草稿')
  expect(document.querySelector('textarea')!.value).toBe('用户原草稿')
  document.querySelector('textarea')!.value = ''
  document.querySelector('.chat-input')!.append(document.createElement('textarea'))
  await expect(testBossComposer({ text, clear: true })).rejects.toThrow('唯一识别')
})
it('框架重新渲染丢失内容时不能误报填写成功', async () => {
  document.querySelector('textarea')!.oninput = event => { (event.target as HTMLTextAreaElement).value = '' }
  expect(await testBossComposer({ text, clear: true })).toMatchObject({ written: false })
})
it('兼容真实 BOSS 的 contenteditable 输入框结构', async () => {
  Object.defineProperty(HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent ?? '' } })
  try {
    document.body.innerHTML = '<div class="chat-im chat-editor"><div class="editor-container"><div id="chat-input" class="chat-input" contenteditable="true"></div></div></div>'
    expect(await testBossComposer({ text, clear: true })).toMatchObject({ written: true, cleared: true })
    expect(document.querySelector('#chat-input')!.textContent).toBe('')
  } finally { delete (HTMLElement.prototype as unknown as Record<string, unknown>).innerText }
})
it('正式填写保留招呼语；会话变化时拒绝旧的核对状态', async () => {
  const expected = await inspectBossComposer()
  const greeting = '你好，想了解这个岗位的工作内容。'
  const result = await runBossComposer({ action: 'fill', text: greeting, expected })
  expect(result).toMatchObject({ written: true, cleared: false, sendActionPerformed: false })
  expect(document.querySelector('textarea')!.value).toBe(greeting)
  document.querySelector('textarea')!.value = ''
  document.body.insertAdjacentHTML('beforeend', '<div class="chat-title">另一联系人</div>')
  Object.defineProperty(HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent ?? '' } })
  try { await expect(runBossComposer({ action: 'fill', text: greeting, expected })).rejects.toThrow('会话或输入框已变化') }
  finally { delete (HTMLElement.prototype as unknown as Record<string, unknown>).innerText }
  expect(document.querySelector('textarea')!.value).toBe('')
})

it('核对后切换到同名同公司的另一会话，也不能使用旧状态填写', async () => {
  Object.defineProperty(HTMLElement.prototype, 'innerText', { configurable: true, get() { return this.textContent ?? '' } })
  try {
    document.body.insertAdjacentHTML('beforeend', '<div class="friend-content selected"><div class="title-box">王先生 · 示例公司</div></div><div class="friend-content"><div class="title-box">王先生 · 示例公司</div></div>')
    const expected = await inspectBossComposer()
    expect(expected.conversationKey).toBeTruthy()
    const items = document.querySelectorAll('.friend-content')
    items[0].classList.remove('selected'); items[1].classList.add('selected')
    await expect(runBossComposer({ action: 'fill', text: '本次核对的草稿', expected })).rejects.toThrow('会话或输入框已变化')
    expect(document.querySelector('textarea')!.value).toBe('')
  } finally { delete (HTMLElement.prototype as unknown as Record<string, unknown>).innerText }
})
