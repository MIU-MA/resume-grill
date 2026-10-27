// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mountDirectPopup } from './direct-popup'

const fake = {
  runtime: { sendMessage: vi.fn(async (_input: unknown): Promise<unknown> => ({ ok: true, data: { profile: {}, attachment: null } })) },
  tabs: { query: vi.fn(async (_input: unknown) => [{ id: 3, url: 'https://example.com/apply' }]) },
  permissions: { request: vi.fn(async (_input: unknown) => true) },
}
const fillButton = () => [...document.querySelectorAll('button')].find(button => button.textContent === '填写当前页面')!
beforeEach(() => { vi.clearAllMocks(); fake.permissions.request.mockResolvedValue(true); fake.tabs.query.mockResolvedValue([{ id: 3, url: 'https://example.com/apply' }]); fake.runtime.sendMessage.mockReset().mockResolvedValue({ ok: true, data: { profile: {}, attachment: null } }); vi.stubGlobal('chrome', fake); document.body.replaceChildren() })
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals() })
it('没有工作台或批量任务也能填写；用户编辑不会被刷新覆盖', async () => {
  mountDirectPopup(document.body)
  await vi.waitFor(() => expect(fillButton().disabled).toBe(false))
  const name = document.querySelector<HTMLInputElement>('[name=name]')!
  name.value = '测试人'; name.dispatchEvent(new Event('input'))
  fake.runtime.sendMessage.mockResolvedValueOnce({ ok: true, data: { profile: { name: '测试人' }, attachment: null, run: { url: 'https://example.com/apply', status: 'done', result: { filled: ['姓名'], uploaded: false, missing: [{ kind: 'profile', key: 'phone', label: '手机号' }], message: '需要补充' } } } })
  fillButton().click()
  expect(fake.permissions.request).toHaveBeenCalledWith({ origins: ['https://example.com/*'] })
  await vi.waitFor(() => expect(fake.runtime.sendMessage).toHaveBeenCalledWith({ type: 'direct-fill', request: { tabId: 3, url: 'https://example.com/apply', data: { profile: { name: '测试人' }, attachment: null } } }))
  await vi.waitFor(() => expect(document.body.textContent).toContain('已填写 1 项'))
  expect(document.body.textContent).toContain('手机号 — 补充上方资料')
  expect(name.value).toBe('测试人')
  expect(document.querySelectorAll('input[required]')).toHaveLength(0)
})
it('拒绝权限不发送资料，非官网标签页仍可以保存资料', async () => {
  mountDirectPopup(document.body)
  await vi.waitFor(() => expect(fillButton().disabled).toBe(false))
  const name = document.querySelector<HTMLInputElement>('[name=name]')!; name.value = '测试人'; name.dispatchEvent(new Event('input'))
  fake.permissions.request.mockResolvedValue(false); fillButton().click()
  await vi.waitFor(() => expect(document.body.textContent).toContain('未允许访问'))
  expect(fake.runtime.sendMessage).toHaveBeenCalledTimes(1)
  document.body.replaceChildren(); fake.tabs.query.mockResolvedValue([{ id: 3, url: 'edge://extensions' }])
  mountDirectPopup(document.body)
  const save = () => [...document.querySelectorAll('button')].find(button => button.textContent === '保存资料')!
  await vi.waitFor(() => expect(save().disabled).toBe(false))
  expect(fillButton().disabled).toBe(true)
  save().click()
  await vi.waitFor(() => expect(fake.runtime.sendMessage).toHaveBeenCalledWith({ type: 'direct-save', data: { profile: {}, attachment: null } }))
})
