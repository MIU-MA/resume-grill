import { smtpConfigSchema, type AgentSnapshot, type SmtpConfig } from '../domain/mail-schema.ts'
import type { CredentialStore } from './credentials.ts'
import type { MailQueue } from './queue.ts'
import { createSmtpTransport } from './smtp.ts'

export async function verifySmtpConfig(config: SmtpConfig) {
  const transport = createSmtpTransport(config)
  try { await transport.verify() }
  catch { throw new Error('邮箱连接失败。请确认已开启 SMTP 服务，填写的是授权码，并检查网络连接。') }
  finally { transport.close() }
}

export class MailAccount {
  private busy = false
  private initialized = false
  private saved = false
  private error: string | undefined
  private readonly queue: MailQueue
  private readonly store: CredentialStore
  private readonly verify: (config: SmtpConfig) => Promise<void>
  constructor(queue: MailQueue, store: CredentialStore, verify: (config: SmtpConfig) => Promise<void> = verifySmtpConfig) {
    this.queue = queue; this.store = store; this.verify = verify
  }

  snapshot(): AgentSnapshot {
    return { ...this.queue.snapshot(), credentials: { supported: this.store.supported, saved: this.saved, restoring: !this.initialized, error: this.error } }
  }
  async restore() {
    if (this.initialized || this.busy) return
    this.busy = true
    try {
      const config = await this.store.load()
      if (config) {
        this.saved = true
        try { await this.verify(config); this.queue.configure(config) }
        catch { this.error = '保存的邮箱暂未连接，请重试恢复或更新授权码' }
      }
    } catch {
      // Preserve an unreadable file until the user explicitly forgets/replaces it.
      this.saved = true
      this.error = '保存的邮箱授权无法读取，可忘记后重新连接'
    } finally { this.busy = false; this.initialized = true }
  }
  private assertIdle() {
    if (!this.initialized || this.busy || this.queue.snapshot().running) throw new Error('正在连接邮箱或发送邮件，请稍后再试')
  }
  async configure(input: SmtpConfig, remember: boolean) {
    this.assertIdle()
    const config = smtpConfigSchema.parse(input)
    if (remember && !this.store.supported) throw new Error('本机暂不支持加密保存授权码，请取消记住本机')
    this.busy = true
    try {
      await this.verify(config)
      if (remember) await this.store.save(config)
      else await this.store.clear()
      this.queue.configure(config)
      this.saved = remember; this.error = undefined
    } finally { this.busy = false }
  }
  async reconnect() {
    this.assertIdle()
    this.busy = true
    try {
      const config = await this.store.load()
      if (!config) throw new Error('没有保存的邮箱授权，请重新填写授权码')
      await this.verify(config)
      this.queue.configure(config)
      this.saved = true; this.error = undefined
    } catch { throw new Error('保存的邮箱未能恢复，请检查网络或更新授权码') }
    finally { this.busy = false }
  }
  disconnect() { this.assertIdle(); this.queue.disconnect() }
  async forget() {
    this.assertIdle(); this.busy = true
    try {
      await this.store.clear()
      this.queue.disconnect(); this.saved = false; this.error = undefined
    } finally { this.busy = false }
  }
  get configuring() { return this.busy || !this.initialized }
}
