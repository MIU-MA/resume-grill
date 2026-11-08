// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { KnowledgeStudy } from './KnowledgeStudy'
import type { KnowledgeItem } from '@/domain/knowledge'
const item: KnowledgeItem = { id: 'a', source: 'manual', title: '幂等', detail: '唯一键避免重复写入', note: '', claimId: '', claimTitle: '', status: 'open', createdAt: 1, updatedAt: 1 }
const host = document.createElement('div'); let root = createRoot(host)
afterEach(async () => { await act(async () => root.unmount()); root = createRoot(host); vi.useRealTimers(); vi.unstubAllGlobals() })
const button = (label: string) => [...host.querySelectorAll('button')].find(button => button.textContent === label)!
it('到期卡片可离线自测，查看参考后评分，日程保存而不自动标记掌握', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); sessionStorage.clear()
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  const update = vi.fn()
  await act(async () => root.render(createElement(KnowledgeStudy, { items: [item], onUpdate: update })))
  await act(async () => button('开始闪卡复习').click())
  expect(host.querySelector('[aria-label="自测回答"]')).not.toBeNull()
  expect(host.textContent).not.toContain('唯一键避免重复写入')
  await act(async () => button('查看参考内容').click())
  expect(host.textContent).toContain('唯一键避免重复写入')
  await act(async () => button('清楚答对').click())
  expect(update).toHaveBeenCalledWith('a', expect.objectContaining({ review: expect.objectContaining({ interval: 1 }) }))
  expect(update.mock.calls[0][1]).not.toHaveProperty('status')
  expect(fetch).not.toHaveBeenCalled()
})
it('五分钟到期后停止出题，刷新恢复同一个截止时间', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); sessionStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(1000000)
  await act(async () => root.render(createElement(KnowledgeStudy, { items: [item], onUpdate: vi.fn() })))
  await act(async () => button('5 分钟盲点突击').click())
  await act(async () => { await vi.advanceTimersByTimeAsync(300000) })
  expect(host.textContent).toContain('5 分钟到了')
  await act(async () => root.unmount()); root = createRoot(host)
  await act(async () => root.render(createElement(KnowledgeStudy, { items: [item], onUpdate: vi.fn() })))
  expect(host.textContent).toContain('5 分钟到了')
})
