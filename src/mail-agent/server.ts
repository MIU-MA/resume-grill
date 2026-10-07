import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { z, ZodError } from 'zod'
import { batchSchema, smtpConfigSchema, sourceUrlSchema } from '../domain/mail-schema.ts'
import type { MailQueue } from './queue.ts'
import { readCareerPage } from './public-page.ts'
import { verifySmtpConfig, type MailAccount } from './account.ts'
import { discoverCareers } from './career-discovery.ts'

export function allowedOrigins(extra?: string) {
  const origins = new Set(['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3107', 'http://127.0.0.1:3107'])
  if (extra) {
    const url = new URL(extra)
    if (url.protocol !== 'https:' || url.username || url.password || extra !== url.origin) throw new Error('MAIL_WORKBENCH_ORIGIN 必须是完整的 HTTPS 来源，例如 https://jobs.example.com（不带路径和末尾斜杠）')
    origins.add(url.origin)
  }
  return origins
}

async function readJson(req: IncomingMessage) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Error('请求必须使用 JSON')
  const limit = 8 * 1024 * 1024
  if (Number(req.headers['content-length'] ?? 0) > limit) throw new Error('请求过大，简历附件不能超过 5 MB')
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('请求过大，简历附件不能超过 5 MB')
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown }
  catch { throw new Error('无法读取请求内容') }
}

export function createAgentHandler(options: { token: string; origins: Set<string>; queue: () => MailQueue; account?: () => MailAccount; port?: number; readPage?: typeof readCareerPage }) {
  let configuring = false
  let readingPage = false
  return async (req: IncomingMessage, res: ServerResponse) => {
    const respond = (status: number, data: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
      res.end(JSON.stringify(data))
    }
    const port = options.port ?? 4318
    const origin = req.headers.origin
    if (!['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') || ![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host ?? '') || !origin || !options.origins.has(origin)) {
      respond(403, { error: '工作台来源未获授权，请检查执行器的来源配置' })
      return
    }
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      res.setHeader('Access-Control-Allow-Private-Network', 'true')
      res.writeHead(204)
      res.end()
      return
    }
    const supplied = Buffer.from(req.headers.authorization?.replace(/^Bearer /, '') ?? '')
    const expected = Buffer.from(options.token)
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      respond(401, { error: '连接码不正确或执行器已重启，请复制终端中新的连接码' })
      return
    }
    try {
      const queue = options.queue()
      const account = options.account?.()
      const snapshot = () => account?.snapshot() ?? queue.snapshot()
      if (req.method === 'GET' && req.url === '/status') { respond(200, snapshot()); return }
      if (req.method !== 'POST') { respond(404, { error: '未找到接口' }); return }
      const body = await readJson(req)
      switch (req.url) {
        case '/configure': {
          if (configuring || queue.snapshot().running) throw new Error('正在连接邮箱或发送邮件，请稍后再试')
          const { remember, ...input } = smtpConfigSchema.safeExtend({ remember: z.boolean().optional().default(false) }).parse(body)
          const config = smtpConfigSchema.parse(input)
          if (account) { await account.configure(config, remember); break }
          if (remember) throw new Error('执行器暂不支持保存授权码，请更新执行器')
          configuring = true
          try {
            await verifySmtpConfig(config)
            queue.configure(config)
          } finally { configuring = false }
          break
        }
        case '/disconnect': if (account) account.disconnect(); else queue.disconnect(); break
        case '/credentials/reconnect':
          if (!account) throw new Error('请更新执行器后重试')
          await account.reconnect(); break
        case '/credentials/forget':
          if (!account) throw new Error('请更新执行器后重试')
          await account.forget(); break
        case '/discover':
        case '/extract': {
          if (readingPage) throw new Error('正在读取招聘页，请稍后再试')
          const { url } = z.object({ url: sourceUrlSchema }).strict().parse(body)
          readingPage = true
          try { respond(200, req.url === '/discover' ? await discoverCareers(url, options.readPage) : await (options.readPage ?? readCareerPage)(url)) }
          finally { readingPage = false }
          return
        }
        case '/batches':
          if (configuring || account?.configuring) throw new Error('请等待邮箱连接完成后重新预览')
          queue.enqueue(batchSchema.parse(body)); break
        case '/pause': queue.pause(); break
        case '/resume':
          if (configuring || account?.configuring) throw new Error('请等待邮箱连接完成')
          queue.start(); break
        case '/job': {
          const command = z.object({ id: z.uuid(), action: z.enum(['retry', 'cancel', 'confirm-sent']) }).strict().parse(body)
          queue.changeJob(command.id, command.action)
          break
        }
        default: respond(404, { error: '未找到接口' }); return
      }
      respond(200, snapshot())
    } catch (error) {
      respond(400, { error: error instanceof ZodError ? '请检查必填内容、邮箱地址、官网链接和附件格式' : error instanceof Error ? error.message : '操作失败，请稍后再试' })
    }
  }
}
