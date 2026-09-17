import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { MailQueue } from '../src/mail-agent/queue.ts'
import { allowedOrigins, createAgentHandler } from '../src/mail-agent/server.ts'

const token = randomBytes(32).toString('hex')
const directory = fileURLToPath(new URL('../.mail-agent/', import.meta.url))
let queue: MailQueue | undefined
const origins = allowedOrigins(process.env.MAIL_WORKBENCH_ORIGIN)
const server = createServer(createAgentHandler({
  token, origins,
  queue: () => { if (!queue) throw new Error('执行器正在启动'); return queue },
}))
server.requestTimeout = 30000
server.headersTimeout = 10000
server.maxConnections = 16
server.on('error', error => {
  console.error((error as NodeJS.ErrnoException).code === 'EADDRINUSE' ? '4318 端口已被占用，请使用已打开的邮箱执行器。' : '邮箱执行器启动失败，请检查本机网络设置。')
  process.exitCode = 1
})
// Bind first so a second instance cannot rewrite an active instance's journal.
server.listen(4318, '127.0.0.1', () => {
  try { queue = new MailQueue(directory) }
  catch {
    console.error('无法读取本地投递记录。请备份 .mail-agent 目录后检查 state.json，程序不会覆盖旧记录。')
    server.close()
    process.exitCode = 1
    return
  }
  console.log('\n邮箱执行器已启动：http://127.0.0.1:4318')
  console.log(`连接码：${token}`)
  console.log(`允许的工作台：${[...origins].join('、')}`)
  console.log('请在工作台的“邮箱投递”中填写连接码和邮箱授权码。')
  console.log('授权码只保存在内存；关闭本窗口会停止后续发送。投递记录保存在 .mail-agent 目录。\n')
})
let stopping = false
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => {
  if (stopping) return
  stopping = true
  queue?.pause()
  console.log('正在停止后续发送，等待当前邮件完成…')
  void (queue?.settled() ?? Promise.resolve()).finally(() => server.close())
})
