// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { requestWebsiteExtension, extensionConnectionReport, type ExtensionConnectionProgress } from './website-extension-connection'

let trace: ExtensionConnectionProgress[]
beforeEach(() => { vi.useFakeTimers(); trace = []; vi.spyOn(window, 'postMessage').mockImplementation(() => {}) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })
const options = () => ({ onProgress: (item: ExtensionConnectionProgress) => trace.push(item) })
function reply(channel: 'progress' | 'response', payload: object, origin = location.origin, requestId?: string) {
  const sent = vi.mocked(window.postMessage).mock.calls[0][0] as { requestId: string }
  window.dispatchEvent(new MessageEvent('message', { source: window, origin, data: { channel: `resume-grill.website.${channel}`, requestId: requestId ?? sent.requestId, ...payload } }))
}

it('没有任何回应时明确停在通信脚本确认前，诊断不猜测扩展未安装', async () => {
  const pending = requestWebsiteExtension('ping', undefined, options())
  const failed = expect(pending).rejects.toThrow('[RG-BRIDGE]')
  await vi.advanceTimersByTimeAsync(10000); await failed
  expect(trace.map(item => item.step)).toEqual(['request', 'error'])
  expect(trace.at(-1)!.detail).toContain('未收到通信脚本或后台的确认')
  expect(vi.getTimerCount()).toBe(0)
})
it('脚本已确认、后台无回应时保留真实版本并指出第二段断开', async () => {
  const pending = requestWebsiteExtension('ping', undefined, options())
  const failed = expect(pending).rejects.toThrow('[RG-BACKGROUND]')
  reply('progress', { step: 'bridge', extensionVersion: '0.2.3', extensionId: 'test-extension' })
  await vi.advanceTimersByTimeAsync(10000); await failed
  expect(trace.map(item => item.step)).toEqual(['request', 'bridge', 'error'])
  expect(trace.at(-1)!.detail).toContain('v0.2.3')
  const report = extensionConnectionReport('http://localhost:3000/applications', trace)
  expect(report).toContain('test-extension'); expect(report).toContain('[RG-BACKGROUND]')
})
it('其他来源、其他请求和错误通道不能伪造脚本确认', async () => {
  const pending = requestWebsiteExtension('ping', undefined, options())
  const failed = expect(pending).rejects.toThrow('[RG-BRIDGE]')
  reply('progress', { step: 'bridge' }, 'https://evil.example')
  reply('progress', { step: 'bridge' }, location.origin, 'other-request')
  reply('progress', { step: 'background' })
  await vi.advanceTimersByTimeAsync(10000); await failed
  expect(trace.some(item => item.step === 'bridge')).toBe(false)
})
it('旧版扩展没有分阶段确认仍可连接，收到后台回应才算成功', async () => {
  const pending = requestWebsiteExtension('ping', undefined, options())
  reply('response', { response: { ok: true, data: { version: 1, extensionVersion: '0.2.2' } } })
  expect(await pending).toEqual({ version: 1, extensionVersion: '0.2.2' })
  expect(trace.at(-1)).toMatchObject({ step: 'background', extensionVersion: '0.2.2' })
  expect(vi.getTimerCount()).toBe(0)
})
it('切换或离开页面取消旧检查，清除计时器并停止回调', async () => {
  const controller = new AbortController()
  const pending = requestWebsiteExtension('ping', undefined, { ...options(), signal: controller.signal })
  const failed = expect(pending).rejects.toThrow('已取消')
  controller.abort(); await failed
  reply('progress', { step: 'bridge' })
  expect(trace).toHaveLength(1)
  expect(vi.getTimerCount()).toBe(0)
})
