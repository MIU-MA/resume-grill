import { describe, expect, it, vi } from 'vitest'
import type { FormResult, WebsiteBatch, WebsiteQueue } from '../domain/website-automation'
import { createWebsiteQueue } from './queue'

const batch = (): WebsiteBatch => ({ id: crypto.randomUUID(), createdAt: 1, profile: { name: '林同学' }, attachment: { name: 'resume.pdf', base64: 'YQ==' }, jobs: [1, 2, 3].map(i => ({ id: crypto.randomUUID(), company: `公司 ${i}`, role: '前端工程师', url: `https://example.com/apply/${i}` })) })
const result: FormResult = { filled: ['姓名'], uploaded: true, missing: [], message: '请核对后提交' }
function setup() {
  let stored: WebsiteQueue | null = null
  const tools = {
    load: vi.fn(async () => structuredClone(stored)),
    save: vi.fn(async (queue: WebsiteQueue | null) => { stored = structuredClone(queue) }),
    open: vi.fn(async (_url: string) => 10 + tools.open.mock.calls.length),
    focus: vi.fn(async (_id: number) => undefined),
    fill: vi.fn(async () => structuredClone(result)),
  }
  return { tools, engine: createWebsiteQueue(tools), stored: () => stored }
}
async function finished(state: ReturnType<typeof setup>) { await vi.waitFor(() => expect(state.stored()?.running).toBe(false)) }

describe('官网批量队列', () => {
  it('按顺序准备整批，工具调用前保存状态；对外快照不带简历文件', async () => {
    const state = setup(); const input = batch()
    state.tools.open.mockImplementation(async () => { expect(state.stored()?.jobs.some(job => job.status === 'opening')).toBe(true); return 10 + state.tools.open.mock.calls.length })
    state.tools.fill.mockImplementation(async () => { expect(state.stored()?.jobs.some(job => job.status === 'filling' && job.tabId !== undefined)).toBe(true); return result })
    await state.engine.stage(input); await state.engine.command('start'); await finished(state)
    expect(state.tools.open.mock.calls.map(call => call[0])).toEqual(input.jobs.map(job => job.url))
    expect(state.stored()?.jobs.map(job => job.status)).toEqual(['ready', 'ready', 'ready'])
    expect(await state.engine.snapshot()).not.toHaveProperty('attachment')
    expect((await state.engine.snapshot())?.attachmentName).toBe('resume.pdf')
  })
  it('某岗位登录或缺项不阻塞其余岗位，补充后复用原标签页及答案', async () => {
    const state = setup(); const input = batch()
    state.tools.fill.mockResolvedValueOnce({ ...result, missing: [{ label: '手机号', key: 'phone', kind: 'profile' }], message: '缺少手机号' })
    await state.engine.stage(input); await state.engine.command('start'); await finished(state)
    expect(state.stored()?.jobs.map(job => job.status)).toEqual(['waiting', 'ready', 'ready'])
    const tabId = state.stored()!.jobs[0].tabId
    await state.engine.command('resume-job', input.jobs[0].id, { phone: '13800138000' }, [{ origin: 'https://example.com', scope: '公司 1\n前端工程师', label: '到岗时间', value: '两周后' }])
    await finished(state)
    expect(state.tools.open).toHaveBeenCalledTimes(3)
    expect(state.stored()?.jobs[0]).toMatchObject({ tabId, status: 'ready' })
    expect(state.stored()?.profile.phone).toBe('13800138000')
    expect(state.stored()?.answers).toHaveLength(1)
  })
  it('暂停允许当前步骤结束，不打开下一页；继续不重复完成的岗位', async () => {
    const state = setup(); const input = batch()
    let release!: (value: FormResult) => void
    state.tools.fill.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    await state.engine.stage(input); await state.engine.command('start')
    await vi.waitFor(() => expect(state.tools.fill).toHaveBeenCalledTimes(1))
    await state.engine.command('pause'); release(result)
    await vi.waitFor(() => expect(state.stored()?.jobs[0].status).toBe('ready'))
    expect(state.tools.open).toHaveBeenCalledTimes(1)
    await state.engine.command('start'); await finished(state)
    expect(state.tools.open).toHaveBeenCalledTimes(3)
  })
  it('并发开始只运行一次，清空后到达的旧结果不能复活任务', async () => {
    const state = setup(); let release!: (value: FormResult) => void
    state.tools.fill.mockImplementationOnce(() => new Promise(resolve => { release = resolve }))
    await state.engine.stage(batch()); await Promise.all([state.engine.command('start'), state.engine.command('start')])
    await vi.waitFor(() => expect(state.tools.fill).toHaveBeenCalledTimes(1))
    await state.engine.command('clear'); release(result)
    await vi.waitFor(() => expect(state.stored()).toBeNull())
    await state.engine.pump()
    expect(state.tools.open).toHaveBeenCalledTimes(1)
    expect(await state.engine.snapshot()).toBeNull()
  })
  it('重启后中断项变为待处理，保留已完成结果，需显式继续', async () => {
    const state = setup(); await state.engine.stage(batch())
    const saved = state.stored()!; saved.jobs[0].status = 'filling'; saved.jobs[0].tabId = 9; saved.jobs[1].status = 'ready'; saved.running = true
    await state.tools.save(saved); await state.engine.recover()
    expect(state.stored()?.running).toBe(false)
    expect(state.stored()?.jobs.map(job => job.status)).toEqual(['waiting', 'ready', 'pending'])
    expect(state.tools.open).not.toHaveBeenCalled()
  })
  it('补齐通用资料后，其他仅缺这项资料的岗位自动重新填写', async () => {
    const state = setup(); const input = batch()
    state.tools.fill.mockResolvedValue({ ...result, missing: [{ label: '手机号', key: 'phone', kind: 'profile' }] })
    await state.engine.stage(input); await state.engine.command('start'); await finished(state)
    expect(state.stored()?.jobs.every(job => job.status === 'waiting')).toBe(true)
    state.tools.fill.mockResolvedValue(result)
    await state.engine.command('resume-job', input.jobs[0].id, { phone: '13800138000' }); await finished(state)
    expect(state.stored()?.jobs.every(job => job.status === 'ready')).toBe(true)
    expect(state.tools.open).toHaveBeenCalledTimes(3)
    expect(state.tools.fill).toHaveBeenCalledTimes(6)
  })
  it('开页失败可重试，已关闭页面只在用户继续时重新打开', async () => {
    const state = setup(); const input = batch()
    state.tools.open.mockRejectedValueOnce(new Error('未授权'))
    await state.engine.stage(input); await state.engine.command('start'); await finished(state)
    expect(state.stored()?.jobs[0]).toMatchObject({ status: 'waiting', detail: '未授权' })
    await state.engine.command('resume-job', input.jobs[0].id, undefined, undefined, { reopen: true }); await finished(state)
    expect(state.stored()?.jobs[0].status).toBe('ready')
    expect(state.tools.open).toHaveBeenCalledTimes(4)
  })
  it('不同批次不能覆盖未结束任务；重复交接同一批次不重置进度', async () => {
    const state = setup(); const input = batch(); await state.engine.stage(input)
    await expect(state.engine.stage(batch())).rejects.toThrow('还有未处理')
    await state.engine.command('start'); await finished(state)
    await state.engine.stage(input)
    expect(state.stored()?.jobs[0].status).toBe('ready')
    await expect(state.engine.stage({ ...input, jobs: [input.jobs[0], input.jobs[0]] })).rejects.toThrow()
  })
  it('存储失败时不打开页面或填写', async () => {
    const state = setup(); state.tools.save.mockRejectedValue(new Error('quota'))
    await expect(state.engine.stage(batch())).rejects.toThrow('quota')
    expect(state.tools.open).not.toHaveBeenCalled(); expect(state.tools.fill).not.toHaveBeenCalled()
  })
})
