// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useToastQueue } from './use-toast-queue'
let hook: ReturnType<typeof useToastQueue>, host: HTMLDivElement, root: Root
function Harness() { hook = useToastQueue(); return null }
beforeEach(async () => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); vi.useFakeTimers(); host = document.createElement('div'); document.body.append(host); root = createRoot(host); await act(async () => root.render(createElement(Harness))) })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })
it('连续提示按队列显示，旧计时器不提前清除下一条，错误须手动关闭', async () => {
  await act(async () => { hook.showToast('第一条', 1000); hook.showToast('第二条', 2000); hook.showToast('保存失败') })
  expect(hook.toast).toBe('第一条')
  await act(async () => vi.advanceTimersByTime(1000)); expect(hook.toast).toBe('第二条')
  await act(async () => vi.advanceTimersByTime(1900)); expect(hook.toast).toBe('第二条')
  await act(async () => vi.advanceTimersByTime(100)); expect(hook.toast).toBe('保存失败'); expect(hook.toastTone).toBe('error')
  await act(async () => vi.advanceTimersByTime(10000)); expect(hook.toast).toBe('保存失败')
  await act(async () => hook.setToast('')); expect(hook.toast).toBe('')
})
