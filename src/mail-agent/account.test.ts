import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { MailAccount } from './account'
import { MailQueue } from './queue'
import type { CredentialStore } from './credentials'
import type { MailBatch, SmtpConfig } from '../domain/mail-schema'

const directories: string[] = []
const config: SmtpConfig = { provider: '163', address: 'candidate@163.com', name: '测试人', authorizationCode: 'TEST-SECRET' }
function temporary() { const dir = mkdtempSync(join(tmpdir(), 'mail-account-test-')); directories.push(dir); return dir }
afterEach(() => {
  for (const dir of directories.splice(0)) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep + 'mail-account-test-')) throw new Error('Unsafe test cleanup path')
    rmSync(dir, { recursive: true, force: true })
  }
})
function store(value: SmtpConfig | null = null) {
  const result: CredentialStore = {
    supported: true,
    load: vi.fn(async () => value),
    save: vi.fn(async config => { value = config }),
    clear: vi.fn(async () => { value = null }),
  }
  return result
}

describe('mail account restore and retention', () => {
  it('restores the verified sender without automatically resuming a paused queue', async () => {
    const dir = temporary(), send = vi.fn().mockResolvedValue(undefined)
    const previous = new MailQueue(dir, { send, interval: 0 }); previous.configure(config)
    const batch: MailBatch = {
      id: randomUUID(), sender: { address: config.address, name: config.name }, attachment: { name: 'resume.txt', base64: Buffer.from('TEST').toString('base64') },
      jobs: [1, 2].map(i => ({ id: randomUUID(), company: '甲', role: `前端${i}`, recipient: `hr${i}@example.com`, sourceUrl: '', subject: '应聘', body: '您好', sourceConfirmed: true })),
    }
    previous.enqueue(batch); previous.pause(); await previous.settled(); send.mockClear()
    const queue = new MailQueue(dir, { send, interval: 0 }), saved = store(config), verify = vi.fn().mockResolvedValue(undefined)
    const account = new MailAccount(queue, saved, verify)
    expect(account.snapshot().credentials?.restoring).toBe(true)
    await account.restore()
    expect(verify).toHaveBeenCalledWith(config)
    expect(account.snapshot()).toMatchObject({ sender: batch.sender, running: false, paused: true, credentials: { saved: true, restoring: false } })
    expect(account.snapshot().jobs.some(job => job.status === 'queued')).toBe(true)
    expect(send).not.toHaveBeenCalled()
    expect(JSON.stringify(account.snapshot())).not.toContain(config.authorizationCode)
  })

  it('saves only after verification; session-only configuration deletes the previous credential', async () => {
    const saved = store(), queue = new MailQueue(temporary()), verify = vi.fn().mockResolvedValue(undefined)
    const account = new MailAccount(queue, saved, verify); await account.restore()
    await account.configure(config, true)
    expect(saved.save).toHaveBeenCalledWith(config)
    expect(account.snapshot().credentials?.saved).toBe(true)
    await account.configure(config, false)
    expect(saved.clear).toHaveBeenCalledOnce()
    expect(account.snapshot()).toMatchObject({ sender: { address: config.address }, credentials: { saved: false } })
  })

  it('a failed new login does not replace existing credentials or expose the secret', async () => {
    const saved = store(config), queue = new MailQueue(temporary()), verify = vi.fn().mockResolvedValue(undefined)
    const account = new MailAccount(queue, saved, verify); await account.restore()
    verify.mockRejectedValueOnce(new Error('Authentication failed'))
    await expect(account.configure({ ...config, address: 'new@163.com' }, true)).rejects.toThrow('Authentication failed')
    expect(saved.save).not.toHaveBeenCalled()
    expect(saved.clear).not.toHaveBeenCalled()
    expect(account.snapshot().sender?.address).toBe(config.address)
  })

  it('forget removes saved authorization and the active sender; disconnect alone keeps the saved credential', async () => {
    const saved = store(config), account = new MailAccount(new MailQueue(temporary()), saved, async () => {})
    await account.restore(); account.disconnect()
    expect(account.snapshot()).toMatchObject({ sender: null, credentials: { saved: true } })
    await account.reconnect()
    expect(account.snapshot().sender?.address).toBe(config.address)
    await account.forget()
    expect(account.snapshot()).toMatchObject({ sender: null, credentials: { saved: false } })
    expect(await saved.load()).toBeNull()
  })

  it('restore failure keeps stored authorization and allows retry; error state hides raw SMTP details', async () => {
    const saved = store(config), verify = vi.fn().mockRejectedValueOnce(new Error(config.authorizationCode)).mockResolvedValue(undefined)
    const account = new MailAccount(new MailQueue(temporary()), saved, verify)
    await account.restore()
    expect(account.snapshot()).toMatchObject({ sender: null, credentials: { saved: true, restoring: false } })
    expect(JSON.stringify(account.snapshot())).not.toContain(config.authorizationCode)
    await account.reconnect()
    expect(account.snapshot().credentials?.error).toBeUndefined()
  })

  it('blocks configuration during restore and rejects saving on unsupported platforms', async () => {
    let finish!: (value: SmtpConfig | null) => void
    const saved = store(); saved.load = () => new Promise(resolve => { finish = resolve })
    const account = new MailAccount(new MailQueue(temporary()), saved, async () => {})
    const restoring = account.restore()
    await expect(account.configure(config, true)).rejects.toThrow('正在连接')
    finish(null); await restoring
    saved.supported = false
    await expect(account.configure(config, true)).rejects.toThrow('暂不支持')
    expect(saved.save).not.toHaveBeenCalled()
  })

  it('failed deletion leaves the current sender and saved status intact', async () => {
    const saved = store(config), account = new MailAccount(new MailQueue(temporary()), saved, async () => {})
    await account.restore()
    saved.clear = async () => { throw new Error('Disk denied') }
    await expect(account.forget()).rejects.toThrow('Disk denied')
    expect(account.snapshot()).toMatchObject({ sender: { address: config.address }, credentials: { saved: true } })
  })

  it('a failed save does not switch the active sender or mark authorization as remembered', async () => {
    const saved = store(), queue = new MailQueue(temporary())
    const account = new MailAccount(queue, saved, async () => {}); await account.restore()
    saved.save = async () => { throw new Error('Disk denied') }
    await expect(account.configure(config, true)).rejects.toThrow('Disk denied')
    expect(account.snapshot()).toMatchObject({ sender: null, credentials: { saved: false } })
  })

  it('restoring a damaged file keeps a recoverable error state until explicitly forgotten', async () => {
    const saved = store(); saved.load = async () => { throw new Error(config.authorizationCode) }
    const account = new MailAccount(new MailQueue(temporary()), saved, async () => {})
    await account.restore()
    expect(account.snapshot()).toMatchObject({ sender: null, credentials: { saved: true, restoring: false } })
    expect(JSON.stringify(account.snapshot())).not.toContain(config.authorizationCode)
    await account.forget()
    expect(account.snapshot().credentials).toMatchObject({ saved: false, error: undefined })
  })
})
