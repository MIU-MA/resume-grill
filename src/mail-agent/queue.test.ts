import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { MailQueue } from './queue'
import { attachmentSchema, batchSchema, MAX_ATTACHMENT_BYTES, smtpConfigSchema, type MailBatch, type SmtpConfig } from '../domain/mail-schema'

const directories: string[] = []
function temp() { const dir = mkdtempSync(join(tmpdir(), 'mail-queue-test-')); directories.push(dir); return dir }
afterEach(() => {
  for (const dir of directories.splice(0)) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep + 'mail-queue-test-')) throw new Error('Unsafe test cleanup path')
    rmSync(dir, { recursive: true, force: true })
  }
})
const config: SmtpConfig = { provider: 'qq', address: 'candidate@qq.com', name: '测试人', authorizationCode: 'SECRET-ONLY-IN-MEMORY' }
function batch(count = 1): MailBatch {
  return {
    id: randomUUID(), sender: { address: config.address, name: config.name },
    jobs: Array.from({ length: count }, (_, index) => ({ id: randomUUID(), company: '测试公司', role: `开发岗位${index}`, sourceUrl: 'https://example.com/careers', recipient: `recruiting${index}@example.com`, subject: '应聘开发岗位-测试人', body: '您好，附件是我的简历。', sourceConfirmed: true })),
    attachment: { name: '简历.txt', base64: Buffer.from('TEST RESUME ONLY').toString('base64') },
  }
}

describe('durable email queue', () => {
  it('sends once, keeps the original attachment, hides credentials, and deduplicates across restart', async () => {
    const dir = temp(); const send = vi.fn().mockResolvedValue(undefined)
    const queue = new MailQueue(dir, { send, interval: 0 }); queue.configure(config)
    const input = batch()
    queue.enqueue(input); queue.enqueue(input)
    await queue.settled()
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][2].toString()).toBe('TEST RESUME ONLY')
    expect(queue.snapshot().jobs[0].status).toBe('sent')
    expect(JSON.stringify(queue.snapshot())).not.toContain(config.authorizationCode)
    expect(readFileSync(join(dir, 'state.json'), 'utf8')).not.toContain(config.authorizationCode)
    const restarted = new MailQueue(dir, { send }); restarted.configure(config)
    const duplicate = batch(); duplicate.jobs[0].subject = '不同主题也不能重投'
    expect(() => restarted.enqueue(duplicate)).toThrow('已有投递记录')
    restarted.enqueue(input)
    expect(send).toHaveBeenCalledTimes(1)
    expect(() => restarted.enqueue({ ...input, attachment: { ...input.attachment, name: '另一个文件.txt' } })).toThrow('内容已改变')
  })

  it('pauses after the in-flight email and requires explicit resume', async () => {
    let finish!: () => void
    const send = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve })).mockResolvedValue(undefined)
    const queue = new MailQueue(temp(), { send, interval: 0 }); queue.configure(config)
    queue.enqueue(batch(2))
    expect(queue.snapshot().jobs.map(job => job.status)).toEqual(['sending', 'queued'])
    expect(() => queue.start()).toThrow('正在处理')
    queue.pause(); finish(); await queue.settled()
    expect(send).toHaveBeenCalledTimes(1)
    queue.start(); await queue.settled()
    expect(send).toHaveBeenCalledTimes(2)
    expect(queue.snapshot().jobs.every(job => job.status === 'sent')).toBe(true)
  })

  it('stops on rejection and retries only after an explicit user operation', async () => {
    const send = vi.fn().mockRejectedValueOnce({ responseCode: 550 }).mockResolvedValue(undefined)
    const queue = new MailQueue(temp(), { send, interval: 0 }); queue.configure(config)
    queue.enqueue(batch(2)); await queue.settled()
    const first = queue.snapshot().jobs[0]
    expect(queue.snapshot().jobs.map(job => job.status)).toEqual(['failed', 'queued'])
    queue.changeJob(first.id, 'retry')
    expect(send).toHaveBeenCalledTimes(1)
    queue.start(); await queue.settled()
    expect(send).toHaveBeenCalledTimes(3)
    expect(send.mock.calls[1][1].messageId).toBe(first.messageId)
  })

  it('does not retry an ambiguous DATA disconnect', async () => {
    const send = vi.fn().mockRejectedValue({ code: 'ETIMEDOUT', command: 'DATA' })
    const queue = new MailQueue(temp(), { send }); queue.configure(config)
    queue.enqueue(batch(2)); await queue.settled()
    const first = queue.snapshot().jobs[0]
    expect(first.status).toBe('uncertain')
    expect(() => queue.changeJob(first.id, 'retry')).toThrow('不支持')
    queue.changeJob(first.id, 'confirm-sent')
    expect(queue.snapshot().jobs[0].detail).toContain('用户核对')
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('recovers a crash as uncertain, leaves unsent jobs paused, and never autostarts', async () => {
    const dir = temp(); const send = vi.fn().mockResolvedValue(undefined)
    const queue = new MailQueue(dir, { send, interval: 0 }); queue.configure(config)
    queue.enqueue(batch(2)); await queue.settled()
    const path = join(dir, 'state.json')
    const journal = JSON.parse(readFileSync(path, 'utf8'))
    journal.jobs[0].status = 'sending'; journal.jobs[1].status = 'queued'
    writeFileSync(path, JSON.stringify(journal))
    const recoveredSend = vi.fn()
    const recovered = new MailQueue(dir, { send: recoveredSend })
    expect(recovered.snapshot().jobs.map(job => job.status)).toEqual(['uncertain', 'queued'])
    expect(recovered.snapshot().paused).toBe(true)
    expect(recoveredSend).not.toHaveBeenCalled()
    expect(() => recovered.start()).toThrow('先连接')
    recovered.configure({ ...config, address: 'another@qq.com' })
    expect(() => recovered.start()).toThrow('原来的发件邮箱')
  })

  it('rejects duplicate rows atomically and rejects headers / unconfirmed sources / oversized files', () => {
    const queue = new MailQueue(temp(), { send: vi.fn() }); queue.configure(config)
    const input = batch(); input.jobs.push({ ...input.jobs[0], id: randomUUID() })
    expect(() => queue.enqueue(input)).toThrow('已有投递记录')
    expect(queue.snapshot().jobs).toHaveLength(0)
    const unsafe = batch(); unsafe.jobs[0].subject = 'title\r\nBcc: stolen@example.com'
    expect(batchSchema.safeParse(unsafe).success).toBe(false)
    expect(batchSchema.safeParse({ ...batch(), jobs: [{ ...batch().jobs[0], sourceConfirmed: false }] }).success).toBe(false)
    expect(smtpConfigSchema.safeParse({ ...config, address: 'candidate@163.com' }).success).toBe(false)
    const fakePdf = batch(); fakePdf.attachment.name = 'fake.pdf'
    expect(() => queue.enqueue(fakePdf)).toThrow('不是 PDF')
  })

  it('refuses a corrupt journal instead of discarding past sends', () => {
    const dir = temp(); writeFileSync(join(dir, 'state.json'), '{broken')
    expect(() => new MailQueue(dir)).toThrow()
  })

  it('fails closed before sending if the journal cannot be written', () => {
    const dir = temp(); const send = vi.fn()
    const queue = new MailQueue(dir, { send }); queue.configure(config)
    mkdirSync(join(dir, 'state.json'))
    expect(() => queue.enqueue(batch())).toThrow('写入失败')
    expect(send).not.toHaveBeenCalled()
    expect(() => queue.start()).toThrow('写入失败')
  })

  it('validates the maximum attachment size without pathological base64 matching', () => {
    const base64 = Buffer.alloc(MAX_ATTACHMENT_BYTES, 1).toString('base64')
    expect(attachmentSchema.safeParse({ name: 'resume.txt', base64 }).success).toBe(true)
    expect(attachmentSchema.safeParse({ name: 'resume.txt', base64: base64 + 'AAAA' }).success).toBe(false)
    expect(attachmentSchema.safeParse({ name: 'resume.txt', base64: 'AA==AAAA' }).success).toBe(false)
  })
})
