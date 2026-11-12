// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ResumeSnapshotPanel } from './ResumeSnapshotPanel'
import { listResumeSnapshots, readResumeSnapshot, saveResumeSnapshot } from './lib/resume-snapshot-client'
import { importResumeTextCopy, type ResumeDocument } from './lib/resume-library'

vi.mock('./lib/resume-snapshot-client', () => ({ listResumeSnapshots: vi.fn(), readResumeSnapshot: vi.fn(), saveResumeSnapshot: vi.fn() }))
vi.mock('./lib/resume-library', () => ({ importResumeTextCopy: vi.fn() }))
const snapshot = { id: 'a'.repeat(32), sourceName: '备份简历.pdf', createdAt: 1 }
let root: Root, host: HTMLDivElement
const onOpen = vi.fn()
const click = async (text: string) => act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === text)!.click())
beforeEach(async () => {
  vi.clearAllMocks()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.mocked(listResumeSnapshots).mockResolvedValue([snapshot])
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(createElement(StrictMode, {}, createElement(ResumeSnapshotPanel, { documents: [{ id: 'local', sourceFile: '原简历.pdf' } as ResumeDocument], onOpen }))))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })

it('严格模式下正常读回列表；保存失败保留备份和选项', async () => {
  expect(host.textContent).toContain(snapshot.sourceName)
  vi.mocked(saveResumeSnapshot).mockRejectedValue(new Error('连接失败'))
  await click('保存文本快照')
  expect(saveResumeSnapshot).toHaveBeenCalledWith('local')
  expect(host.querySelector('[role=alert]')?.textContent).toContain('连接失败')
  expect(host.textContent).toContain(snapshot.sourceName)
  expect(host.querySelector('select')?.value).toBe('local')
})

it('读取成功但副本保存失败时不跳转；重试成功后才打开', async () => {
  vi.mocked(readResumeSnapshot).mockResolvedValue({ ...snapshot, rawText: '恢复正文' })
  vi.mocked(importResumeTextCopy).mockRejectedValueOnce(new Error('空间不足'))
  await click('导入文本副本')
  expect(onOpen).not.toHaveBeenCalled()
  expect(host.textContent).toContain('空间不足')
  const copy = { id: 'copy' } as ResumeDocument
  vi.mocked(importResumeTextCopy).mockResolvedValue(copy)
  await click('导入文本副本')
  expect(importResumeTextCopy).toHaveBeenCalledWith(snapshot.sourceName, '恢复正文')
  expect(onOpen).toHaveBeenCalledWith(copy)
})

it('连续点击保存只发起一次请求', async () => {
  let resolve!: (value: typeof snapshot & { rawText: string }) => void
  vi.mocked(saveResumeSnapshot).mockReturnValue(new Promise(done => { resolve = done }))
  const button = [...host.querySelectorAll('button')].find(item => item.textContent === '保存文本快照')!
  await act(async () => { button.click(); button.click() })
  expect(saveResumeSnapshot).toHaveBeenCalledTimes(1)
  await act(async () => resolve({ ...snapshot, id: 'b'.repeat(32), rawText: '正文' }))
  expect(host.textContent).toContain('文本快照已保存')
})
