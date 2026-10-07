import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { LocalCredentialStore, type CredentialCipher } from './credentials'
import type { SmtpConfig } from '../domain/mail-schema'

const directories: string[] = []
const config: SmtpConfig = { provider: '163', address: 'candidate@163.com', name: '测试人', authorizationCode: 'TEST-ONLY-NOT-A-REAL-CREDENTIAL' }
async function temporary() { const dir = await mkdtemp(join(tmpdir(), 'mail-credentials-test-')); directories.push(dir); return dir }
afterEach(async () => {
  for (const dir of directories.splice(0)) {
    if (!resolve(dir).startsWith(resolve(tmpdir()) + sep + 'mail-credentials-test-')) throw new Error('Unsafe test cleanup path')
    await rm(dir, { recursive: true, force: true })
  }
})
function cipher(): CredentialCipher {
  const key = randomBytes(32)
  return {
    supported: true,
    async protect(value) {
      const iv = randomBytes(12), encrypt = createCipheriv('aes-256-gcm', key, iv)
      const encrypted = Buffer.concat([encrypt.update(value), encrypt.final()])
      return Buffer.concat([iv, encrypt.getAuthTag(), encrypted])
    },
    async unprotect(value) {
      const decrypt = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12))
      decrypt.setAuthTag(value.subarray(12, 28))
      return Buffer.concat([decrypt.update(value.subarray(28)), decrypt.final()])
    },
  }
}

describe('local encrypted SMTP credentials', () => {
  it('encrypts, survives a new store instance, replaces the previous sender and forgets cleanly', async () => {
    const dir = await temporary(), encryption = cipher(), store = new LocalCredentialStore(dir, encryption)
    expect(await store.load()).toBeNull()
    await store.save(config)
    expect((await readFile(join(dir, 'credentials.dpapi'))).toString()).not.toContain(config.authorizationCode)
    expect(await new LocalCredentialStore(dir, encryption).load()).toEqual(config)
    const changed: SmtpConfig = { ...config, provider: 'qq', address: 'candidate@qq.com', authorizationCode: 'TEST-REPLACEMENT' }
    await store.save(changed)
    expect(await store.load()).toEqual(changed)
    expect(await readdir(dir)).toEqual(['credentials.dpapi'])
    await store.clear(); await store.clear()
    expect(await store.load()).toBeNull()
  })

  it('does not overwrite an existing credential when encryption fails', async () => {
    const dir = await temporary(), encryption = cipher()
    await new LocalCredentialStore(dir, encryption).save(config)
    const original = await readFile(join(dir, 'credentials.dpapi'))
    const failing = new LocalCredentialStore(dir, { ...encryption, protect: async () => { throw new Error('Cannot encrypt') } })
    await expect(failing.save(config)).rejects.toThrow()
    expect(await readFile(join(dir, 'credentials.dpapi'))).toEqual(original)
  })

  it('keeps damaged or foreign-account ciphertext for explicit deletion and never exposes raw errors', async () => {
    const dir = await temporary()
    await new LocalCredentialStore(dir, cipher()).save(config)
    await expect(new LocalCredentialStore(dir, cipher()).load()).rejects.toThrow('无法解密')
    await writeFile(join(dir, 'credentials.dpapi'), config.authorizationCode)
    await expect(new LocalCredentialStore(dir, cipher()).load()).rejects.toThrow('无法解密')
    expect((await readFile(join(dir, 'credentials.dpapi'))).toString()).toBe(config.authorizationCode)
  })

  it('unsupported systems never fall back to plaintext storage', async () => {
    const encryption = { ...cipher(), supported: false }
    const dir = await temporary(), store = new LocalCredentialStore(dir, encryption)
    await expect(store.save(config)).rejects.toThrow('暂不支持')
    expect(await readdir(dir)).toEqual([])
  })

  it.skipIf(process.platform !== 'win32')('uses real Windows current-user DPAPI with a test-only credential', async () => {
    const dir = await temporary(), store = new LocalCredentialStore(dir)
    await store.save(config)
    const encrypted = await readFile(join(dir, 'credentials.dpapi'))
    expect(encrypted.toString()).not.toContain(config.authorizationCode)
    expect(await new LocalCredentialStore(dir).load()).toEqual(config)
    await store.clear()
    expect(await store.load()).toBeNull()
  }, 20000)
})
