import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { superviseLocalProcesses } from '../src/lib/local-processes.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
async function assertFree(port: number) {
  await new Promise<void>((done, reject) => {
    const probe = createServer()
    probe.once('error', () => reject(new Error(`${port} 端口不可用。请先关闭已有服务，或分别使用 npm run dev 与 npm run mail-agent。`)))
    probe.listen(port, '127.0.0.1', () => probe.close(error => error ? reject(error) : done()))
  })
}

try {
  await assertFree(3000)
  await assertFree(4318)
  const web = spawn(process.execPath, [resolve(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3000'], { cwd: root, stdio: 'inherit', windowsHide: true })
  const agent = spawn(process.execPath, ['--import', 'tsx', resolve(root, 'scripts/mail-agent.ts')], { cwd: root, stdio: ['inherit', 'inherit', 'inherit', 'ipc'], windowsHide: true })
  const supervisor = superviseLocalProcesses({ web, agent }, {
    onFailure: message => console.error(message),
    onExit: code => { process.exitCode = code },
  })
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => supervisor.stop())
  console.log('正在启动网页和执行器。网页就绪后打开 http://127.0.0.1:3000')
  console.log('连接码将在下方显示；在“连接本机”中填写。Ctrl+C 停止两项服务，发送中的邮件会先等待结果。')
} catch (error) {
  console.error(error instanceof Error ? error.message : '启动失败')
  process.exitCode = 1
}
