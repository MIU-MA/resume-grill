import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { smtpConfigSchema, type SmtpConfig } from '../domain/mail-schema.ts'

export interface CredentialStore {
  supported: boolean
  load(): Promise<SmtpConfig | null>
  save(config: SmtpConfig): Promise<void>
  clear(): Promise<void>
}
export interface CredentialCipher {
  supported: boolean
  protect(value: Buffer): Promise<Buffer>
  unprotect(value: Buffer): Promise<Buffer>
}

// Secrets travel through stdin, never command arguments, environment or logs.
function dpapi(operation: 'Protect' | 'Unprotect', value: Buffer): Promise<Buffer> {
  if (process.platform !== 'win32') return Promise.reject(new Error('本机暂不支持加密保存授权码'))
  const script = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security; $bytes=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $entropy=[Text.Encoding]::UTF8.GetBytes('resume-grill:smtp:v1'); $result=[Security.Cryptography.ProtectedData]::${operation}($bytes,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($result))`
  return new Promise((resolve, reject) => {
    const powershell = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    const child = spawn(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script], { windowsHide: true, timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] })
    let output = ''
    let tooLarge = false
    const fail = () => reject(new Error('本机授权码加密处理失败，请检查 Windows 账户权限'))
    child.on('error', fail)
    child.stdin.on('error', fail)
    child.stdout.on('data', chunk => {
      output += String(chunk)
      if (output.length > 65536) { tooLarge = true; child.kill() }
    })
    child.stderr.resume()
    child.on('close', code => {
      if (code !== 0 || tooLarge || !output || !/^[A-Za-z0-9+/]+={0,2}$/.test(output)) { fail(); return }
      resolve(Buffer.from(output, 'base64'))
    })
    child.stdin.end(value.toString('base64'))
  })
}

export const windowsCredentialCipher: CredentialCipher = {
  supported: process.platform === 'win32',
  protect: value => dpapi('Protect', value),
  unprotect: value => dpapi('Unprotect', value),
}

export class LocalCredentialStore implements CredentialStore {
  readonly supported: boolean
  private readonly path: string
  private readonly directory: string
  private readonly cipher: CredentialCipher
  constructor(directory: string, cipher: CredentialCipher = windowsCredentialCipher) {
    this.directory = directory; this.cipher = cipher
    this.supported = cipher.supported
    this.path = join(directory, 'credentials.dpapi')
  }
  async load() {
    try {
      if ((await stat(this.path)).size > 65536) throw new Error('Invalid credential file')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw new Error('保存的邮箱授权无法读取，可在设置中忘记后重新连接')
    }
    if (!this.supported) throw new Error('此系统无法解密保存的邮箱授权，请在原 Windows 账户中使用')
    try {
      const decrypted = await this.cipher.unprotect(await readFile(this.path))
      return smtpConfigSchema.parse(JSON.parse(decrypted.toString('utf8')))
    } catch { throw new Error('保存的邮箱授权无法解密，可在设置中忘记后重新连接') }
  }
  async save(config: SmtpConfig) {
    if (!this.supported) throw new Error('本机暂不支持加密保存授权码，请取消记住本机')
    const parsed = smtpConfigSchema.parse(config)
    const encrypted = await this.cipher.protect(Buffer.from(JSON.stringify(parsed), 'utf8'))
    const temporary = join(this.directory, `credentials.${randomUUID()}.tmp`)
    await mkdir(this.directory, { recursive: true, mode: 0o700 })
    try {
      const file = await open(temporary, 'wx', 0o600)
      try { await file.writeFile(encrypted); await file.sync() } finally { await file.close() }
      await rename(temporary, this.path)
    } catch { throw new Error('本机授权码未能保存，请检查磁盘和目录权限') }
    finally { await unlink(temporary).catch(() => undefined) }
  }
  async clear() {
    try { await unlink(this.path) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('本机授权码未能删除，请检查目录权限')
    }
  }
}
