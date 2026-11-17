import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** A CDP transport scoped to one ego task space; reuses the existing reader and queue. */
export class EgoCdpSocket extends EventTarget {
  readyState: number = WebSocket.OPEN
  private timer?: ReturnType<typeof setTimeout>
  private pending = 0
  private endpoint: string
  private token: string
  private dispose: () => Promise<void>
  private constructor(endpoint: string, token: string, dispose: () => Promise<void>) { super(); this.endpoint = endpoint; this.token = token; this.dispose = dispose }
  static async connect() {
    const directory = await mkdtemp(join(tmpdir(), 'resume-grill-ego-'))
    if (!/^resume-grill-ego-[^\\/]+$/.test(relative(resolve(tmpdir()), resolve(directory)))) throw new Error('ego 临时目录无效')
    const token = randomBytes(32).toString('hex')
    const entry = join(directory, 'entry.mjs')
    const runtime = new URL('./ego-cdp-runtime.mjs', import.meta.url).href
    const readyFile = join(directory, 'ready.json')
    await writeFile(entry, `import { runEgoCdpRuntime } from ${JSON.stringify(runtime)}; await runEgoCdpRuntime(${JSON.stringify({ token, name: `Resume Grill workbench ${token.slice(0, 8)}`, readyFile })});`, { mode: 0o600 })
    let executable = process.env.EGO_BROWSER_EXECUTABLE || 'ego-browser'
    if (!process.env.EGO_BROWSER_EXECUTABLE && process.platform === 'win32') {
      const installed = join(homedir(), '.local/share/ego/active_version_dir/ego-browser.exe')
      try { await access(installed); executable = installed } catch { /* Use PATH on other installations. */ }
    }
    const child = spawn(executable, ['nodejs', '-e', `await import(${JSON.stringify(pathToFileURL(entry).href)})`], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    const cleanup = async () => { child.kill(); await rm(directory, { recursive: true, force: true }) }
    try {
      const port = await new Promise<number>((resolve, reject) => {
        const stop = () => { clearTimeout(timer); clearInterval(check) }
        const timer = setTimeout(() => { stop(); reject(new Error('ego 启动超时，请先打开 ego 并完成首次设置')) }, 30000)
        const check = setInterval(() => { void readFile(readyFile, 'utf8').then(value => { const ready = JSON.parse(value); if (Number.isInteger(ready.port) && ready.port > 0 && ready.port < 65536) { stop(); child.removeListener('exit', fail); resolve(ready.port) } }).catch(() => {}) }, 100)
        const fail = () => { stop(); reject(new Error('ego 运行时已退出，请检查安装及任务空间状态')) }
        child.once('error', error => { stop(); reject(new Error(`无法启动 ego-browser：${error.message}`)) })
        child.once('exit', fail)
        child.stdout.resume()
        child.stderr.resume()
      })
      const socket = new EgoCdpSocket(`http://127.0.0.1:${port}/`, token, cleanup)
      child.once('exit', () => { void socket.closed() })
      socket.poll()
      return socket
    } catch (error) { await cleanup(); throw error }
  }
  private async request(value: object) {
    const response = await fetch(this.endpoint, { method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(value), signal: AbortSignal.timeout(25000), redirect: 'error' })
    const data = await response.json() as { result?: unknown; error?: { message: string }; events?: object[] }
    if (!response.ok && !data.error) throw new Error('ego 本机运行时请求失败')
    return data
  }
  private emitEvents(events?: object[]) { for (const event of events ?? []) this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(event) })) }
  send(value: string) {
    const input = JSON.parse(value)
    this.pending++
    void this.request(input).then(result => {
      this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ id: input.id, result: result.result, error: result.error }) }))
      this.emitEvents(result.events)
    }).catch(error => {
      this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ id: input.id, error: { message: error.message } }) }))
      void this.close()
    }).finally(() => { this.pending-- })
  }
  private poll() {
    this.timer = setTimeout(async () => {
      if (this.readyState !== WebSocket.OPEN) return
      try {
        if (!this.pending) {
          const result = await this.request({ method: '__poll' })
          if (result.error) throw new Error(result.error.message)
          this.emitEvents(result.events)
        }
      }
      catch { await this.closed(); return }
      if (this.readyState === WebSocket.OPEN) this.poll()
    }, 500)
    this.timer.unref()
  }
  private async closed() {
    if (this.readyState === WebSocket.CLOSED) return
    this.readyState = WebSocket.CLOSED; clearTimeout(this.timer)
    this.dispatchEvent(new Event('close')); await this.dispose()
  }
  async close() {
    if (this.readyState !== WebSocket.OPEN) return
    this.readyState = WebSocket.CLOSING; clearTimeout(this.timer)
    try { await this.request({ method: '__close' }) } finally { await this.closed() }
  }
}
