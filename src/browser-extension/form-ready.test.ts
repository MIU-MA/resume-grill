// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { hasApplicationControls, waitForApplicationControls } from './form-ready'
afterEach(() => { document.body.replaceChildren(); vi.useRealTimers() })
it('搜索框先加载时继续等待实际申请表，超时也能返回', async () => {
  vi.useFakeTimers()
  document.body.innerHTML = '<input placeholder="搜索岗位">'
  expect(hasApplicationControls()).toBe(false)
  let ready = false
  const wait = waitForApplicationControls().then(() => { ready = true })
  await vi.advanceTimersByTimeAsync(1000)
  expect(ready).toBe(false)
  document.body.insertAdjacentHTML('beforeend', '<div class="ant-form-item"><div class="ant-form-item-label">姓名</div><input></div>')
  await vi.advanceTimersByTimeAsync(500); await wait
  expect(ready).toBe(true)
  document.body.replaceChildren()
  const timeout = waitForApplicationControls()
  await vi.advanceTimersByTimeAsync(4000); await timeout
})
