import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createBrowserBatch } from './browser-batch'
const directories: string[] = []
async function directory() { const value = await mkdtemp(join(tmpdir(), 'resume-batch-test-')); directories.push(value); return value }
const batch = () => ({ id: randomUUID(), jobs: [{ url: 'https://www.zhipin.com/job_detail/fixture.html', title: '全栈', company: '测试公司', greeting: '核对正文' }], images: [] })
afterEach(async () => {
  for (const value of directories.splice(0)) {
    if (!/^resume-batch-test-[^\\/]+$/.test(relative(resolve(tmpdir()), resolve(value)))) throw new Error('无效测试目录')
    await rm(resolve(value), { recursive: true, force: true })
  }
})
it('并发重复提交只执行一次，执行之前已有初始日志，改内容必须换编号', async () => {
  const path = await directory(), input = batch()
  const execute = vi.fn(async () => { const saved = JSON.parse(await readFile(join(path, input.id + '.json'), 'utf8')); expect(saved.run.state).toBe('running') })
  const manager = createBrowserBatch(path, { mode: 'boss', execute })
  await Promise.all([manager.start(input), manager.start(input)])
  await manager.close()
  expect(execute).toHaveBeenCalledTimes(1)
  await expect(manager.start({ ...input, jobs: [{ ...input.jobs[0], greeting: '变更正文' }] })).rejects.toThrow('内容已变化')
})
it('退出后的任务只恢复为待核对，不隐式执行；新实例也不能重发旧编号', async () => {
  const path = await directory(), input = batch()
  const manager = createBrowserBatch(path, { mode: 'boss', execute: async (_batch, run, save) => { run.tasks[0].state = 'running'; run.tasks[0].steps[0].state = 'sending'; await save(run) } })
  await manager.start(input); await manager.close()
  const execute = vi.fn(async () => {})
  const restored = createBrowserBatch(path, { mode: 'boss', execute })
  expect(await restored.status(input.id)).toMatchObject({ state: 'paused', tasks: [{ state: 'uncertain' }] })
  await restored.start(input)
  expect(execute).not.toHaveBeenCalled()
  await restored.close()
})

it('新连接可列出原目录中的真实批次，崩溃前的运行状态只能显示为暂停', async () => {
  const path = await directory(), completed = batch(), interrupted = batch()
  const manager = createBrowserBatch(path, { mode: 'boss', execute: async (_batch, run, save) => {
    if (run.id === completed.id) {
      run.state = 'finished'; run.tasks[0].state = 'verified'
    }
    await save(run)
  } })
  const clock = vi.spyOn(Date, 'now').mockReturnValue(1000)
  try {
    await manager.start(completed); await manager.close()
    clock.mockReturnValue(2000)
    await manager.start(interrupted); await manager.close()
  } finally { clock.mockRestore() }
  const execute = vi.fn()
  const restored = createBrowserBatch(path, { mode: 'boss', execute })
  expect(await restored.recent()).toEqual([
    { id: interrupted.id, createdAt: expect.any(Number), state: 'paused', total: 1, verified: 0, companies: ['测试公司'] },
    { id: completed.id, createdAt: expect.any(Number), state: 'finished', total: 1, verified: 1, companies: ['测试公司'] },
  ])
  expect(execute).not.toHaveBeenCalled()
})
