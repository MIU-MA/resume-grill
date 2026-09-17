import { createHash } from 'node:crypto'
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { batchSchema, mailDraftSchema, MAX_ATTACHMENT_BYTES, type AgentSnapshot, type MailBatch, type MailJob, type SmtpConfig } from '../domain/mail-schema.ts'
import { classifySmtpError, sendApplication } from './smtp.ts'

const digest = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')
export function duplicateKey(job: Pick<MailJob, 'recipient' | 'role' | 'sender'>) {
  return digest([job.sender.address, job.recipient, job.role.normalize('NFKC').replace(/\s+/g, '')].join('\n').toLowerCase())
}
const storedJobSchema = mailDraftSchema.extend({
  batchId: z.uuid(), sender: batchSchema.shape.sender,
  status: z.enum(['queued', 'sending', 'sent', 'failed', 'uncertain', 'cancelled']),
  messageId: z.string().max(254).regex(/^<[a-f\d-]+@[a-z\d.-]+>$/),
  attachment: z.object({ hash: z.string().regex(/^[a-f\d]{64}$/), name: z.string(), size: z.number().int().positive().max(MAX_ATTACHMENT_BYTES) }),
  createdAt: z.number(), updatedAt: z.number(), detail: z.string().optional(),
})
const journalSchema = z.object({ version: z.literal(1), jobs: z.array(storedJobSchema).max(2000), batches: z.record(z.string(), z.string()) })
type Send = (config: SmtpConfig, job: MailJob, content: Buffer) => Promise<void>

export class MailQueue {
  private jobs: MailJob[] = []
  private batches: Record<string, string> = {}
  private config: SmtpConfig | null = null
  private running = false
  private paused = true
  private fatalError: string | undefined
  private worker: Promise<void> | null = null
  private readonly directory: string
  private readonly send: Send
  private readonly interval: number

  constructor(directory: string, options: { send?: Send; interval?: number } = {}) {
    this.directory = directory
    this.send = options.send ?? sendApplication
    this.interval = options.interval ?? 5000
    mkdirSync(join(directory, 'attachments'), { recursive: true, mode: 0o700 })
    const path = join(directory, 'state.json')
    if (existsSync(path)) {
      // A malformed journal must stop startup, never silently erase duplicate protection.
      const journal = journalSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
      this.jobs = journal.jobs
      this.batches = journal.batches
      for (const job of this.jobs) {
        if (job.status === 'sending') {
          job.status = 'uncertain'
          job.detail = '上次执行器在发送中退出，请核对邮箱发信记录。本条不会自动重发。'
          job.updatedAt = Date.now()
        }
      }
      this.persist()
    }
  }

  snapshot(): AgentSnapshot {
    return structuredClone({
      version: 1, running: this.running, paused: this.paused,
      sender: this.config ? { name: this.config.name, address: this.config.address } : null,
      jobs: this.jobs, fatalError: this.fatalError,
    })
  }

  configure(config: SmtpConfig) {
    if (this.running) throw new Error('请先暂停并等待当前邮件完成，再更换发件邮箱')
    this.config = { ...config }
  }

  disconnect() {
    if (this.running) throw new Error('请先暂停并等待当前邮件完成')
    this.config = null
  }

  private persist() {
    try {
      const temp = join(this.directory, 'state.json.tmp')
      const fd = openSync(temp, 'w', 0o600)
      try {
        writeFileSync(fd, JSON.stringify({ version: 1, jobs: this.jobs, batches: this.batches }))
        fsyncSync(fd)
      } finally { closeSync(fd) }
      renameSync(temp, join(this.directory, 'state.json'))
    } catch {
      this.fatalError = '本地投递记录写入失败，发送已停止。请检查磁盘和目录权限后重启执行器。'
      this.paused = true
      throw new Error(this.fatalError)
    }
  }

  enqueue(input: MailBatch) {
    const batch = batchSchema.parse(input)
    const fingerprint = digest(JSON.stringify(batch))
    if (Object.hasOwn(this.batches, batch.id)) {
      if (this.batches[batch.id] !== fingerprint) throw new Error('这批投递的内容已改变，请重新核对后创建新批次')
      return // Retrying a timed-out HTTP response must not enqueue or restart anything.
    }
    if (this.fatalError) throw new Error(this.fatalError)
    if (!this.config || batch.sender.address !== this.config.address || batch.sender.name !== this.config.name) throw new Error('发件邮箱已变化，请连接邮箱并重新预览')
    if (this.running || this.jobs.some(job => job.status === 'queued')) throw new Error('请先完成或取消上一批待发送的邮件')
    if (this.jobs.length + batch.jobs.length > 2000) throw new Error('本机投递记录已达 2000 条，请先备份记录再整理本地数据目录')
    const content = Buffer.from(batch.attachment.base64, 'base64')
    if (!content.length || content.length > MAX_ATTACHMENT_BYTES) throw new Error('简历附件不能超过 5 MB')
    if (/\.pdf$/i.test(batch.attachment.name) && content.subarray(0, 5).toString() !== '%PDF-') throw new Error('附件内容不是 PDF，请重新选择文件')
    if (/\.docx$/i.test(batch.attachment.name) && !content.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))) throw new Error('附件内容不是 DOCX，请重新选择文件')
    const keys = new Set(this.jobs.filter(job => job.status !== 'cancelled').map(duplicateKey))
    const ids = new Set(this.jobs.map(job => job.id))
    for (const draft of batch.jobs) {
      const key = duplicateKey({ ...draft, sender: batch.sender })
      if (keys.has(key) || ids.has(draft.id)) throw new Error(`「${draft.company} / ${draft.role}」已有投递记录，不能重复加入；发送失败的邮件请在记录中重试`)
      keys.add(key)
      ids.add(draft.id)
    }
    const hash = digest(content)
    writeFileSync(join(this.directory, 'attachments', hash), content, { mode: 0o600 })
    const now = Date.now()
    this.jobs.push(...batch.jobs.map(draft => ({
      ...draft, batchId: batch.id, sender: batch.sender, status: 'queued' as const,
      messageId: `<${draft.id}@${batch.sender.address.split('@')[1]}>`,
      attachment: { hash, name: batch.attachment.name, size: content.length },
      createdAt: now, updatedAt: now,
    })))
    this.batches[batch.id] = fingerprint
    this.persist()
    this.start()
  }

  start() {
    if (this.fatalError) throw new Error(this.fatalError)
    if (this.running) throw new Error('正在处理当前邮件，请稍后继续')
    const config = this.config
    if (!config) throw new Error('请先连接发件邮箱')
    const pending = this.jobs.filter(job => job.status === 'queued')
    if (!pending.length) throw new Error('没有待发送的邮件')
    if (pending.some(job => job.sender.address !== config.address || job.sender.name !== config.name)) throw new Error('请使用本批邮件原来的发件邮箱和姓名继续发送')
    this.paused = false
    this.running = true
    this.worker = this.run(config).catch(() => {
      this.paused = true
      this.fatalError ??= '执行器遇到错误，发送已停止。请重启后核对投递记录。'
    }).finally(() => { this.running = false })
  }

  pause() { this.paused = true }
  async settled() { await this.worker }

  private async run(config: SmtpConfig) {
    while (!this.paused) {
      const job = this.jobs.find(item => item.status === 'queued')
      if (!job) break
      let content: Buffer
      try {
        content = readFileSync(join(this.directory, 'attachments', job.attachment.hash))
        if (digest(content) !== job.attachment.hash) throw new Error('attachment changed')
      } catch {
        job.status = 'failed'
        job.detail = '本地简历附件缺失或已改变，未发送。请取消本条并重新添加附件。'
        job.updatedAt = Date.now()
        this.paused = true
        this.persist()
        break
      }
      job.status = 'sending'
      job.updatedAt = Date.now()
      this.persist() // Durable intent before any SMTP side effect.
      try {
        await this.send(config, structuredClone(job), content)
        job.status = 'sent'
        job.detail = '发件邮箱服务已接受邮件；不代表招聘方已收到或阅读。'
      } catch (error) {
        Object.assign(job, classifySmtpError(error))
        this.paused = true
      }
      job.updatedAt = Date.now()
      this.persist()
      if (!this.paused && this.jobs.some(item => item.status === 'queued')) await new Promise(resolve => setTimeout(resolve, this.interval))
    }
    this.paused = true
  }

  changeJob(id: string, action: 'retry' | 'cancel' | 'confirm-sent') {
    if (this.running) throw new Error('请先暂停并等待当前邮件完成')
    if (this.fatalError) throw new Error(this.fatalError)
    const job = this.jobs.find(item => item.id === id)
    if (!job) throw new Error('未找到这条投递记录')
    if (action === 'retry' && job.status === 'failed') {
      job.status = 'queued'
      job.detail = '已由用户重新加入队列，等待继续发送。'
    } else if (action === 'cancel' && ['queued', 'failed', 'uncertain'].includes(job.status)) {
      job.status = 'cancelled'
      job.detail = '已由用户取消；这不会撤回已提交给邮箱服务的邮件。'
    } else if (action === 'confirm-sent' && job.status === 'uncertain') {
      job.status = 'sent'
      job.detail = '用户核对后标记为已发送。'
    } else throw new Error('当前状态不支持此操作')
    job.updatedAt = Date.now()
    this.persist()
  }
}
