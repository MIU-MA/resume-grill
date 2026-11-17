import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { afterEach, expect, it, vi } from 'vitest'
import { EgoCdpSocket } from './ego-cdp-connection'
import { runEgoCdpRuntime } from './ego-cdp-runtime.mjs'

const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn }))
let socket: EgoCdpSocket | undefined
let completed: Promise<unknown> | undefined
afterEach(async () => { await socket?.close(); await completed; socket = undefined; completed = undefined; vi.unstubAllGlobals(); vi.restoreAllMocks() })

function fixture() {
  const state = { ownership: 'agent' }
  const finish = vi.fn(async () => {})
  const cdp = vi.fn(async () => ({ frameTree: { frame: { id: 'frame-1' } } }))
  const page = { label: 'p1', cdp, events: async () => [] }
  const tabs: any[] = [{ label: 'p1', targetId: 'target-1', url: 'https://www.zhipin.com/web/geek/jobs', title: '岗位', page }]
  const task = { spaceId: 5, tabs: async () => tabs, page: (label: string) => tabs.find(tab => tab.label === label).page, finish,
    newPage: async () => { const child = { ...page, label: 'p2' }; tabs.push({ label: 'p2', targetId: 'target-2', url: 'about:blank', title: '', page: child }); return child },
    cdp: async () => ({ targetInfo: { openerId: 'target-2' } }),
    adopt: vi.fn(async (child: typeof page) => { const tab = tabs.find(tab => tab.page === child); tab.label = child.label; return child }),
  }
  vi.stubGlobal('taskSpace', vi.fn(async () => task))
  vi.stubGlobal('listTaskSpaces', async () => [{ id: 5, ownership: state.ownership }])
  spawn.mockImplementation((_path, args: string[]) => {
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn() })
    const entry = JSON.parse(args[2].match(/import\((.*)\)/)![1])
    void readFile(fileURLToPath(entry), 'utf8').then(source => {
      const options = JSON.parse(source.match(/runEgoCdpRuntime\((\{.*\})\)/)![1])
      completed = runEgoCdpRuntime(options)
      void completed.catch(error => child.emit('error', error))
    })
    return child
  })
  return { state, finish, cdp, task, tabs, page }
}
function command(socket: EgoCdpSocket, id: number, method: string, params = {}, sessionId?: string) {
  return new Promise<any>((resolve, reject) => {
    const listener = (event: Event) => {
      const data = JSON.parse((event as MessageEvent).data)
      if (data.id !== id) return
      socket.removeEventListener('message', listener)
      if (data.error) reject(new Error(data.error.message)); else resolve(data.result)
    }
    socket.addEventListener('message', listener)
    socket.send(JSON.stringify({ id, method, params, sessionId }))
  })
}
it('通过私有握手连接无 stdout 输出的 ego 运行时，复用 CDP 并关闭自有空间', async () => {
  const { finish, cdp } = fixture()
  socket = await EgoCdpSocket.connect()
  expect((await command(socket, 1, 'Target.getTargets')).targetInfos).toMatchObject([{ targetId: 'target-1' }])
  const session = await command(socket, 2, 'Target.attachToTarget', { targetId: 'target-1' })
  expect(await command(socket, 3, 'Page.getFrameTree', {}, session.sessionId)).toHaveProperty('frameTree.frame.id', 'frame-1')
  expect(cdp).toHaveBeenCalledWith('Page.getFrameTree', {})
  await expect(command(socket, 4, 'Browser.close')).rejects.toThrow('不允许')
  await socket.close()
  expect(finish).toHaveBeenCalledWith({ keep: [] })
  expect(socket.readyState).toBe(WebSocket.CLOSED)
})
it('用户接管后拒绝浏览器命令，断开时保留用户控制的空间', async () => {
  const { state, finish, cdp } = fixture()
  socket = await EgoCdpSocket.connect()
  state.ownership = 'user'
  await expect(command(socket, 1, 'Target.getTargets')).rejects.toThrow('用户接管')
  await socket.close()
  expect(finish).not.toHaveBeenCalled()
  expect(cdp).not.toHaveBeenCalled()
})

it('只接入本批自有岗位页产生的沟通新页，不接管用户打开的新页', async () => {
  const { tabs, task, page } = fixture()
  socket = await EgoCdpSocket.connect()
  await command(socket, 1, 'Target.createTarget', { url: 'about:blank' })
  tabs.push({ targetId: 'popup-1', url: 'https://www.zhipin.com/web/geek/chat', title: '', openedBy: 'agent', page: { ...page, label: 'p3' } })
  const targets = await command(socket, 2, 'Target.getTargets')
  expect(targets.targetInfos.find((target: any) => target.targetId === 'popup-1').openerId).toBe('target-2')
  expect(await command(socket, 3, 'Target.attachToTarget', { targetId: 'popup-1' })).toEqual({ sessionId: 'ego:p3' })
  expect(task.adopt).toHaveBeenCalledTimes(1)
  tabs.push({ targetId: 'popup-user', url: 'https://www.zhipin.com/web/geek/chat', title: '', openedBy: 'user', page: { ...page, label: 'p4' } })
  await command(socket, 4, 'Target.getTargets')
  await expect(command(socket, 5, 'Target.attachToTarget', { targetId: 'popup-user' })).rejects.toThrow('不能接管')
  expect(task.adopt).toHaveBeenCalledTimes(1)
})
