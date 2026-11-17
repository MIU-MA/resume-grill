import { expect, it, vi } from 'vitest'
import type { BrowserRun } from '../domain/browser-application'
import { runApplicationQueue, type BrowserDeliveryAdapter } from './application-queue'
const makeRun = (): BrowserRun => ({ id: 'test', mode: 'simulation', state: 'running', createdAt: 1, updatedAt: 1, tasks: [{ url: 'job1', title: '全栈', company: '测试', state: 'queued', steps: [{ id: 'text', kind: 'greeting', value: '你好', state: 'pending' }, { id: 'image', kind: 'image', value: 'hash', state: 'pending' }] }] })
const adapter = (): BrowserDeliveryAdapter => ({ open: vi.fn(async () => {}), checkRecipient: vi.fn(async () => true), send: vi.fn(async () => {}), receipt: vi.fn(async (_task, step) => ({ id: step.id, value: step.value })) })
it('发送前落盘，按招呼语、图片顺序发送并验证，重放已完成任务不重复发', async () => {
  const run = makeRun(), port = adapter(), journal: BrowserRun[] = []
  const save = vi.fn(async (snapshot: BrowserRun) => { journal.push(snapshot) })
  vi.mocked(port.send).mockImplementation(async (_task, step) => { expect(journal.at(-1)?.tasks[0].steps.find(item => item.id === step.id)?.state).toBe('sending') })
  await runApplicationQueue(run, port, save)
  expect(run.tasks[0].state).toBe('verified')
  expect(vi.mocked(port.send).mock.calls.map(call => call[1].kind)).toEqual(['greeting', 'image'])
  await runApplicationQueue(run, port, save)
  expect(port.send).toHaveBeenCalledTimes(2)
})
it('会话不匹配时不发送，也不继续后面的岗位', async () => {
  const run = makeRun(); run.tasks.push({ ...structuredClone(run.tasks[0]), url: 'job2' })
  const port = adapter(); vi.mocked(port.checkRecipient).mockResolvedValue(false)
  await runApplicationQueue(run, port, async () => {})
  expect(port.send).not.toHaveBeenCalled()
  expect(run.tasks.map(task => task.state)).toEqual(['failed', 'queued'])
  expect(run.state).toBe('paused')
})
it('消息发送后无回执，标为待核对；重启后不自动重发', async () => {
  const run = makeRun(), port = adapter(); vi.mocked(port.receipt).mockResolvedValue(null)
  await runApplicationQueue(run, port, async () => {})
  expect(run.tasks[0].steps[0].state).toBe('uncertain')
  await runApplicationQueue(run, port, async () => {})
  expect(port.send).toHaveBeenCalledTimes(1)
  expect(run.state).toBe('paused')
})
it('崩溃恢复时，sending 状态不能重发；日志保存失败也不发送', async () => {
  const run = makeRun(), port = adapter(); run.tasks[0].steps[0].state = 'sending'
  await runApplicationQueue(run, port, async () => {})
  expect(run.tasks[0].state).toBe('uncertain'); expect(port.send).not.toHaveBeenCalled()
  await expect(runApplicationQueue(makeRun(), port, async () => { throw new Error('磁盘满') })).rejects.toThrow('磁盘满')
  expect(port.send).not.toHaveBeenCalled()
})
it('图片回执哈希不匹配时保留招呼语成功状态；暂停在下一步骤生效', async () => {
  const run = makeRun(), port = adapter()
  vi.mocked(port.receipt).mockImplementation(async (_task, step) => ({ id: step.id, value: step.kind === 'image' ? 'wrong' : step.value }))
  await runApplicationQueue(run, port, async () => {})
  expect(run.tasks[0].steps.map(step => step.state)).toEqual(['verified', 'uncertain'])
  const paused = makeRun(); let stop = false
  const next = adapter(); vi.mocked(next.send).mockImplementation(async () => { stop = true })
  await runApplicationQueue(paused, next, async () => {}, () => stop)
  expect(paused.tasks[0].steps.map(step => step.state)).toEqual(['verified', 'pending'])
  expect(paused.state).toBe('paused')
})
it('建立沟通后断连保留已完成步骤，当前消息待核对，后续岗位不执行', async () => {
  const run = makeRun(); run.mode = 'boss'
  run.tasks[0].steps.unshift({ id: 'contact', kind: 'contact', value: 'job1', state: 'pending' })
  run.tasks.push({ ...structuredClone(run.tasks[0]), url: 'job2' })
  const port = adapter()
  vi.mocked(port.send).mockImplementation(async (_task, step) => { if (step.kind === 'greeting') throw new Error('Chrome 调试连接已断开') })
  await runApplicationQueue(run, port, async () => {})
  expect(run.state).toBe('paused')
  expect(run.tasks[0].steps.map(step => step.state)).toEqual(['verified', 'uncertain', 'pending'])
  expect(run.tasks[1].state).toBe('queued')
  await runApplicationQueue(run, port, async () => {})
  expect(vi.mocked(port.send).mock.calls.filter(call => call[0].url === 'job1')).toHaveLength(2)
})

it('官网已自动发送招呼时不追加自定义文字，记录真实官网内容，再发送图片', async () => {
  const run = makeRun(), port = adapter()
  port.resolveGreeting = vi.fn(async () => ({ id: 'platform-message-1', value: '官网账号默认招呼' }))
  await runApplicationQueue(run, port, async () => {})
  expect(vi.mocked(port.send).mock.calls.map(call => call[1].kind)).toEqual(['image'])
  expect(run.tasks[0].steps[0]).toMatchObject({ source: 'platform', value: '官网账号默认招呼', requestedValue: '你好', receipt: 'platform-message-1', state: 'verified' })
  await runApplicationQueue(run, port, async () => {})
  expect(port.resolveGreeting).toHaveBeenCalledTimes(1)
})

it('未核对到官网自动招呼时暂停，不补发任何文字和图片', async () => {
  const run = makeRun(), port = adapter()
  port.resolveGreeting = vi.fn(async () => { throw new Error('官网自动招呼未确认') })
  await runApplicationQueue(run, port, async () => {})
  expect(port.send).not.toHaveBeenCalled()
  expect(run.state).toBe('paused')
  expect(run.tasks[0].steps.map(step => step.state)).toEqual(['pending', 'pending'])
})
