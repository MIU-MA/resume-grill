import { spawn, type ChildProcess } from 'node:child_process'

/** Own only these child processes; never terminate an unrelated occupied port. */
export function superviseLocalProcesses(children: { web: ChildProcess; agent: ChildProcess }, options: {
  stopWeb?: (child: ChildProcess) => void
  onFailure?: (name: string) => void
  onExit?: (code: number) => void
} = {}) {
  const running = new Set(Object.values(children))
  let stopping = false
  let exitCode = 0
  const stopWeb = options.stopWeb ?? (child => {
    if (process.platform === 'win32' && child.pid) {
      // Next's CLI owns a worker. Stop only the process tree we launched.
      const task = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' })
      task.on('error', () => child.kill())
    } else child.kill('SIGTERM')
  })
  const stop = (code = 0) => {
    exitCode = Math.max(exitCode, code)
    if (stopping) return
    stopping = true
    if (running.has(children.web)) stopWeb(children.web)
    if (running.has(children.agent) && children.agent.connected) {
      children.agent.send({ type: 'workbench:shutdown' }, error => {
        if (error) options.onFailure?.('执行器的停止请求未送达，请在终端检查状态')
      })
    }
    // Do not force-kill the agent: an SMTP submission may be in flight.
  }
  for (const [name, child] of Object.entries(children)) {
    child.once('error', () => {
      running.delete(child)
      options.onFailure?.(`${name === 'web' ? '网页' : '执行器'}启动失败`)
      stop(1)
      if (!running.size) options.onExit?.(exitCode)
    })
    child.once('exit', () => {
      if (!running.delete(child)) return
      if (!stopping) { options.onFailure?.(`${name === 'web' ? '网页' : '执行器'}已退出`); stop(1) }
      if (!running.size) options.onExit?.(exitCode)
    })
  }
  return { stop }
}
