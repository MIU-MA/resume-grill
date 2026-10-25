import { EventEmitter } from 'node:events'
import { spawn, type ChildProcess } from 'node:child_process'
import { expect, it, vi } from 'vitest'
import { superviseLocalProcesses } from './local-processes'

function child() { return Object.assign(new EventEmitter(), { connected: true, send: vi.fn(), kill: vi.fn() }) }
it('退出时等待执行器完成，重复信号不会重复停止或强制终止邮件', () => {
  const web = child(), agent = child(), stopWeb = vi.fn(), onExit = vi.fn()
  const supervisor = superviseLocalProcesses({ web: web as unknown as ChildProcess, agent: agent as unknown as ChildProcess }, { stopWeb, onExit })
  supervisor.stop(); supervisor.stop()
  expect(stopWeb).toHaveBeenCalledOnce()
  expect(agent.send).toHaveBeenCalledOnce()
  web.emit('exit', 0)
  expect(onExit).not.toHaveBeenCalled()
  expect(agent.kill).not.toHaveBeenCalled()
  agent.emit('exit', 0)
  expect(onExit).toHaveBeenCalledWith(0)
})
it('一项异常退出时停止另一项并报告失败', () => {
  const web = child(), agent = child(), stopWeb = vi.fn(), onExit = vi.fn()
  superviseLocalProcesses({ web: web as unknown as ChildProcess, agent: agent as unknown as ChildProcess }, { stopWeb, onExit })
  agent.emit('error', new Error('spawn failed'))
  expect(stopWeb).toHaveBeenCalledWith(web)
  web.emit('exit', 0)
  expect(onExit).toHaveBeenCalledWith(1)
})
it('真实子进程能退出，执行器收到停止通知后自行结束（不启动服务）', async () => {
  const web = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true })
  const agent = spawn(process.execPath, ['-e', "process.on('message', m => { if (m.type === 'workbench:shutdown') { process.send('settled'); process.disconnect() } })"], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true })
  const messages: unknown[] = []
  agent.on('message', message => messages.push(message))
  try {
    const code = await new Promise<number>(done => {
      const supervisor = superviseLocalProcesses({ web, agent }, { onExit: done })
      supervisor.stop()
    })
    expect(messages).toEqual(['settled'])
    expect(code).toBe(0)
  } finally {
    if (web.exitCode === null && web.signalCode === null) web.kill()
    if (agent.exitCode === null && agent.signalCode === null) agent.kill()
  }
}, 10000)
