import { describe, expect, it, vi } from 'vitest'
import { get } from 'idb-keyval'
import { createAssistantWriter, loadAssistantStore, type AssistantStore } from './assistant-storage'

vi.mock('idb-keyval', () => ({ get: vi.fn(), set: vi.fn() }))
const store = (goal: string): AssistantStore => ({ version: 1, goal, task: null })

describe('求职任务存储', () => {
  it('按请求顺序写入，前一次失败也可以保存后续进度', async () => {
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const calls: string[] = []
    const writer = createAssistantWriter(async value => {
      calls.push(value.goal)
      if (value.goal === 'first') { await gate; throw new Error('quota') }
    })
    const first = writer(store('first'))
    const rejected = expect(first).rejects.toThrow('quota')
    const second = writer(store('second'))
    await Promise.resolve(); await Promise.resolve()
    expect(calls).toEqual(['first'])
    release(); await rejected; await second
    expect(calls).toEqual(['first', 'second'])
  })
  it('刷新后运行中的任务改为暂停，保留简历、岗位与来源，不自动开始', async () => {
    const saved = { ...store('前端'), task: { version: 1, id: 'task', goal: '前端', createdAt: 1, updatedAt: 2, status: 'running', message: '正在处理', resume: { id: 'resume', name: '简历', text: 'React', updatedAt: 1 }, sources: [{ company: '示例', url: 'https://example.com', status: 'done' }], jobs: [] } }
    vi.mocked(get).mockResolvedValue(saved)
    const restored = await loadAssistantStore()
    expect(restored.task).toEqual({ ...saved.task, status: 'paused', message: '上次任务已中断，已完成的结果已保留，可以继续。' })
    expect(saved.task.status).toBe('running')
  })
  it('新用户返回空记录，损坏记录报错而不是默默清空', async () => {
    vi.mocked(get).mockResolvedValueOnce(undefined).mockResolvedValueOnce({ version: 99, goal: '旧记录' })
    expect(await loadAssistantStore()).toEqual(store(''))
    await expect(loadAssistantStore()).rejects.toThrow('记录无法读取')
  })
})
