import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { resumeSnapshot, resumeSnapshotSummary } from '@/domain/resume-snapshot'
import { proxyResumeSnapshot } from './workbench-proxy'

const token = randomBytes(32).toString('hex')
const source = { sourceName: '演示简历.pdf', rawText: '张三\nGo / SQLite 项目\n负责 API 与测试。' }
let directory = '', executable = '', port = 0
let database = ''
let service: ChildProcess | undefined
let output = ''

async function freePort() {
  const probe = createServer()
  probe.listen(0, '127.0.0.1')
  await once(probe, 'listening')
  const address = probe.address()
  if (!address || typeof address === 'string') throw new Error('No loopback port')
  await new Promise<void>((done, reject) => probe.close(error => error ? reject(error) : done()))
  return address.port
}

async function stop() {
  if (!service) return
  const child = service
  service = undefined
  if (child.exitCode === null && child.signalCode === null) {
    const closed = once(child, 'close')
    child.kill()
    await closed
  }
}

async function start(owner = 'local') {
  port = await freePort()
  output = ''
  service = spawn(executable, ['-listen', `127.0.0.1:${port}`, '-db', database, '-owner', owner], {
    env: { ...process.env, WORKBENCH_TOKEN: token }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  })
  let failure: Error | undefined
  service.on('error', error => { failure = error })
  service.stderr!.on('data', chunk => { output += chunk.toString() })
  service.stdout!.resume()
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    if (failure) throw failure
    if (service.exitCode !== null) throw new Error(`Go exited during startup: ${output}`)
    try {
      const response = await fetch(`http://127.0.0.1:${port}/readyz`, { signal: AbortSignal.timeout(500) })
      if (response.ok) { await response.body?.cancel(); vi.stubEnv('WORKBENCH_TOKEN', token); vi.stubEnv('WORKBENCH_PORT', String(port)); return }
      await response.body?.cancel()
    } catch { /* The test process has not bound the socket yet. */ }
    await new Promise(done => setTimeout(done, 50))
  }
  throw new Error(`Go readiness timeout: ${output}`)
}

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'resume-grill-go-test-'))
  executable = join(directory, process.platform === 'win32' ? 'workbench.exe' : 'workbench')
  await promisify(execFile)('go', ['build', '-o', executable, './cmd/workbench'], {
    cwd: resolve('server'), env: { ...process.env, CGO_ENABLED: '0' }, timeout: 150000, windowsHide: true,
  })
})
beforeEach(() => { database = join(directory, `${randomBytes(8).toString('hex')}.db`) })
afterEach(async () => { vi.restoreAllMocks(); await stop(); vi.unstubAllEnvs() })
afterAll(async () => {
  await stop()
  // Only remove the exact temporary directory allocated by this test suite.
  if (directory && dirname(directory) === tmpdir() && basename(directory).startsWith('resume-grill-go-test-')) {
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
})

function request(method = 'GET') {
  return new Request('http://localhost:3000/api/local-resumes', {
    method, ...(method === 'POST' ? { headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: JSON.stringify(source) } : {}),
  })
}

it('真实 HTTP 保存后重启进程，仍能经网页桥接读回相同文本', async () => {
  await start()
  const created = await proxyResumeSnapshot(request('POST'))
  expect(created.status).toBe(201)
  const snapshot = resumeSnapshot.parse(await created.json())
  expect(snapshot).toMatchObject(source)
  await stop()
  await start()
  const listing = await proxyResumeSnapshot(request())
  expect(resumeSnapshotSummary.array().parse(await listing.json())).toEqual([{ id: snapshot.id, sourceName: source.sourceName, createdAt: snapshot.createdAt }])
  const loaded = await proxyResumeSnapshot(request(), snapshot.id)
  expect(loaded.status).toBe(200)
  expect(await loaded.json()).toEqual(snapshot)
  expect(output).not.toContain(token)
})

it('令牌不一致、跨归属读取和进程退出都不会返回伪成功', async () => {
  await start()
  vi.stubEnv('WORKBENCH_TOKEN', 'incorrect-token-at-least-thirty-two-characters')
  const denied = await proxyResumeSnapshot(request('POST'))
  expect(denied.status).toBe(502)
  expect(await denied.text()).toContain('令牌不一致')
  vi.stubEnv('WORKBENCH_TOKEN', token)
  expect(await (await proxyResumeSnapshot(request())).json()).toEqual([])
  const created = resumeSnapshot.parse(await (await proxyResumeSnapshot(request('POST'))).json())
  await stop()
  await start('other-owner')
  expect((await proxyResumeSnapshot(request(), created.id)).status).toBe(404)
  expect(await (await proxyResumeSnapshot(request())).json()).toEqual([])
  await stop()
  expect((await proxyResumeSnapshot(request())).status).toBe(503)
})

it('落库后响应中断，提示先核对且不会自动重复写入', async () => {
  await start()
  const realFetch = globalThis.fetch
  const transport = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const upstream = await realFetch(input, init)
    await upstream.body?.cancel()
    return new Response(new ReadableStream({ start(controller) { controller.error(new Error('response lost after commit')) } }), { status: upstream.status })
  })
  const uncertain = await proxyResumeSnapshot(request('POST'))
  expect(uncertain.status).toBe(503)
  expect(await uncertain.text()).toContain('刷新备份列表核对')
  expect(transport).toHaveBeenCalledOnce()
  transport.mockRestore()
  const listing = await proxyResumeSnapshot(request())
  expect(resumeSnapshotSummary.array().parse(await listing.json())).toHaveLength(1)
})
