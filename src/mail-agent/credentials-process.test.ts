import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { spawn } from 'node:child_process'
import { windowsCredentialCipher } from './credentials'

vi.mock('node:child_process', () => ({ spawn: vi.fn() }))
const platform = Object.getOwnPropertyDescriptor(process, 'platform')!
let child: EventEmitter & { stdin: PassThrough; stdout: PassThrough; stderr: PassThrough; kill: ReturnType<typeof vi.fn> }
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks()
  Object.defineProperty(process, 'platform', { ...platform, value: 'win32' })
  child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn(() => { child.emit('close', null, 'SIGTERM'); return true }) })
  vi.mocked(spawn).mockReturnValue(child as unknown as ReturnType<typeof spawn>)
})
afterEach(() => { Object.defineProperty(process, 'platform', platform); vi.useRealTimers() })

it('PowerShell 冷启动超过 10 秒仍可完成；敏感数据仅通过 stdin 传递', async () => {
  const secret = Buffer.from('TEST-ONLY-CREDENTIAL')
  const result = windowsCredentialCipher.protect(secret)
  await vi.advanceTimersByTimeAsync(12000)
  expect(child.kill).not.toHaveBeenCalled()
  expect(JSON.stringify(vi.mocked(spawn).mock.calls)).not.toContain(secret.toString())
  expect(child.stdin.read().toString()).toBe(secret.toString('base64'))
  child.stdout.write(Buffer.from('encrypted').toString('base64')); child.emit('close', 0)
  expect(await result).toEqual(Buffer.from('encrypted'))
  expect(vi.getTimerCount()).toBe(0)
})
it('超时终止子进程并给出准确提示，不能误报为账户权限问题', async () => {
  const result = windowsCredentialCipher.protect(Buffer.from('TEST-ONLY'))
  const assertion = expect(result).rejects.toThrow('超时（30 秒）')
  await vi.advanceTimersByTimeAsync(30000)
  await assertion
  expect(child.kill).toHaveBeenCalledOnce()
  expect(vi.getTimerCount()).toBe(0)
})
it('真实加密失败立即拒绝并清理计时器，不泄露 PowerShell 错误内容', async () => {
  const result = windowsCredentialCipher.unprotect(Buffer.from('test ciphertext'))
  const assertion = expect(result).rejects.toThrow('本机授权码加密处理失败')
  child.stderr.write('PRIVATE-ERROR-DETAILS'); child.emit('close', 1)
  await assertion
  expect(vi.getTimerCount()).toBe(0)
})
it('无法启动 PowerShell 时清理计时器，不遗留一个延迟超时', async () => {
  const result = windowsCredentialCipher.protect(Buffer.from('TEST-ONLY'))
  const assertion = expect(result).rejects.toThrow('本机授权码加密处理失败')
  child.emit('error', new Error('spawn failure'))
  await assertion
  expect(vi.getTimerCount()).toBe(0)
})
