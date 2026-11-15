import { expect, it, vi } from 'vitest'
import { createBossDraftSession } from './boss-draft-session'
const state = { chat: true, conversation: '当前联系人', fields: [{ tag: 'DIV', id: 'chat-input', className: 'chat-input', role: null, placeholder: null, editable: true, empty: true, ancestors: [] }] }
const draft = { url: 'https://www.zhipin.com/job_detail/example.html', company: '示例公司', title: '全栈开发', text: '你好，想了解该岗位。' }
const page = () => ({ url: vi.fn(() => 'https://www.zhipin.com/web/geek/chat'), isClosed: () => false, evaluate: vi.fn(async () => state) })
it('预览绑定文本，确认后仅填写一次；不允许重放凭据', async () => {
  const session = createBossDraftSession(), target = page()
  const preview = await session.preview(target, draft)
  target.evaluate.mockResolvedValueOnce({ written: true, cleared: false, characters: 10, sendActionPerformed: false } as never)
  await expect(session.fill(target, preview.id, false)).rejects.toThrow('先核对')
  await expect(session.fill(target, preview.id, true)).resolves.toMatchObject({ written: true, sendActionPerformed: false })
  expect(target.evaluate).toHaveBeenLastCalledWith(expect.any(Function), { action: 'fill', text: draft.text, expected: state })
  await expect(session.fill(target, preview.id, true)).rejects.toThrow('过期')
})
it('页面更换或凭据过期时拒绝写入', async () => {
  let now = 1
  const session = createBossDraftSession(() => now), target = page()
  const preview = await session.preview(target, draft)
  now += 30001
  await expect(session.fill(target, preview.id, true)).rejects.toThrow('过期')
  const next = await session.preview(target, draft)
  target.url.mockReturnValue('https://www.zhipin.com/web/geek/jobs')
  await expect(session.fill(target, next.id, true)).rejects.toThrow('页面已变化')
  expect(target.evaluate).toHaveBeenCalledTimes(2)
})
it('已有输入不提供可填写凭据', async () => {
  const target = page(); target.evaluate.mockResolvedValue({ ...state, fields: [{ ...state.fields[0], empty: false }] })
  await expect(createBossDraftSession().preview(target, draft)).rejects.toThrow('已有草稿')
})
