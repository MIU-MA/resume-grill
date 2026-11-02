// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useUndoQueue } from './use-undo-queue'

let queue: ReturnType<typeof useUndoQueue>, host: HTMLDivElement, root: Root
function Harness() { queue = useUndoQueue(1000); return null }
beforeEach(async () => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(createElement(Harness)))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('各项独立过期，关闭或过期提示不会执行恢复', async () => {
  const restore = vi.fn()
  await act(async () => queue.add('第一项', restore))
  await act(async () => vi.advanceTimersByTime(500))
  await act(async () => queue.add('第二项', restore))
  await act(async () => vi.advanceTimersByTime(500))
  expect(queue.items.map(item => item.label)).toEqual(['第二项'])
  await act(async () => queue.dismiss(queue.items[0].id))
  expect(queue.items).toEqual([]); expect(restore).not.toHaveBeenCalled()
})

it('异步恢复期间不重复执行或过期，成功才移除提示', async () => {
  let finish!: () => void
  const restore = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
  await act(async () => queue.add('异步项', restore))
  const id = queue.items[0].id
  let pending!: Promise<void>
  await act(async () => { pending = queue.undo(id); void queue.undo(id) })
  expect(restore).toHaveBeenCalledTimes(1)
  await act(async () => { vi.advanceTimersByTime(2000); queue.dismiss(id) })
  expect(queue.items[0].pending).toBe(true)
  await act(async () => { finish(); await pending })
  expect(queue.items).toEqual([])
})

it('恢复失败保留提示和错误，重试成功后清除', async () => {
  const restore = vi.fn().mockRejectedValueOnce(new Error('storage unavailable')).mockResolvedValue(undefined)
  await act(async () => queue.add('删除项', restore))
  const id = queue.items[0].id
  await act(async () => queue.undo(id))
  expect(queue.items[0].error).toContain('请重试')
  await act(async () => queue.undo(id))
  expect(restore).toHaveBeenCalledTimes(2); expect(queue.items).toEqual([])
})
