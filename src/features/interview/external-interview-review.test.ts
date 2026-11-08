// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { ExternalInterviewReview } from './ExternalInterviewReview'
import { practiceRequest } from './lib/practice-request'
const db = vi.hoisted(() => ({ records: [] as unknown[] }))
vi.mock('idb-keyval', () => ({ get: async () => db.records, update: async (_key: string, change: (value: unknown[]) => unknown[]) => { db.records = change(db.records) } }))
vi.mock('./lib/practice-request', () => ({ practiceRequest: vi.fn() }))
it('真实面试复盘先保存记录，再按勾选内容导入自测卡片；重新打开可恢复原始记录', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); db.records = []
  const add = vi.fn(), host = document.createElement('div'); let root = createRoot(host)
  const result = { summary: '需要解释重复请求的处理。', gaps: [{ topic: '幂等', explanation: '补充幂等键的存储和冲突处理。', question: '幂等键如何处理并发？', evidence: '先检查唯一键', kind: 'knowledge' }] }
  vi.mocked(practiceRequest).mockResolvedValue(result)
  try {
    await act(async () => root.render(createElement(ExternalInterviewReview, { onAdd: add })))
    const inputs = host.querySelectorAll('textarea')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(inputs[1], '我会先检查唯一键')
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }))
    })
    const button = (label: string) => [...host.querySelectorAll('button')].find(button => button.textContent === label)!
    await act(async () => button('复盘并保存').click())
    expect(db.records).toHaveLength(1)
    expect(add).not.toHaveBeenCalled()
    await act(async () => button('将勾选内容加入待复习').click())
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ title: '幂等', question: '幂等键如何处理并发？', note: '面试原话：先检查唯一键' }))
    await act(async () => root.unmount()); root = createRoot(host)
    await act(async () => root.render(createElement(ExternalInterviewReview, { onAdd: add })))
    const select = host.querySelector('select')!
    await act(async () => { select.value = select.options[1].value; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(host.querySelectorAll('textarea')[1].value).toBe('我会先检查唯一键')
    expect(host.textContent).toContain(result.summary)
    expect(practiceRequest).toHaveBeenCalledOnce()
  } finally { await act(async () => root.unmount()); vi.unstubAllGlobals() }
})
