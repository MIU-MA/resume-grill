import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NO_APPLICATION_FORM } from '../domain/website-automation'
import { fillTab } from './fill-tab'

const url = 'https://example.com/apply'
const frames = [
  { frameId: 0, documentId: 'top', result: url },
  { frameId: 2, documentId: 'child', result: 'https://example.com/form' },
  { frameId: 3, documentId: 'other', result: 'https://other.example/form' },
]
const data = { profile: { name: '测试人' }, answers: [], scope: '' }
const fake = {
  permissions: { contains: vi.fn(async () => true) },
  scripting: { executeScript: vi.fn(async (_input: unknown) => frames) },
  tabs: { get: vi.fn(async () => ({ url })), sendMessage: vi.fn(async (_id: number, _message: unknown, _options: unknown) => ({ result: { filled: ['姓名'], uploaded: false, missing: [], message: '请核对' } as import('../domain/website-automation').FormResult })) },
}
beforeEach(() => {
  vi.clearAllMocks()
  fake.scripting.executeScript.mockReset().mockResolvedValue(frames)
  fake.permissions.contains.mockResolvedValue(true)
  fake.tabs.get.mockResolvedValue({ url })
  vi.stubGlobal('chrome', fake)
})
afterEach(() => vi.unstubAllGlobals())
it('填写同源内嵌文档并合并结果，不向第三方文档发送资料', async () => {
  const result = await fillTab(1, url, data)
  expect(fake.scripting.executeScript.mock.calls[1][0]).toMatchObject({ target: { frameIds: [0, 2] } })
  expect(fake.tabs.sendMessage).toHaveBeenCalledTimes(2)
  expect(fake.tabs.sendMessage).toHaveBeenCalledWith(1, expect.objectContaining({ expectedUrl: frames[1].result }), { documentId: 'child' })
  expect(result.filled).toHaveLength(2)
  expect(result.missing[0].label).toContain('内嵌表单')
})
it('内嵌文档在探测后跳转时不把资料交给新文档', async () => {
  fake.scripting.executeScript.mockResolvedValueOnce(frames).mockResolvedValueOnce([frames[0], { ...frames[1], documentId: 'changed' }])
  const result = await fillTab(1, url, data)
  expect(fake.tabs.sendMessage).toHaveBeenCalledTimes(1)
  expect(result.missing.length).toBeGreaterThan(0)
})
it('无法读取全部子页面时回退顶层表单，同时提示人工核对', async () => {
  fake.scripting.executeScript.mockRejectedValueOnce(new Error('没有子页权限')).mockResolvedValueOnce([frames[0]]).mockResolvedValueOnce([frames[0]])
  const result = await fillTab(1, url, data)
  expect(fake.tabs.sendMessage).toHaveBeenCalledOnce()
  expect(result.missing.length).toBeGreaterThan(0)
})
it('页面整体跳转或未授权时停止，不发送资料', async () => {
  fake.tabs.get.mockResolvedValueOnce({ url: 'https://other.example/form' })
  await expect(fillTab(1, url, data)).rejects.toThrow('页面已变化')
  fake.permissions.contains.mockResolvedValue(false)
  await expect(fillTab(1, url, data)).rejects.toThrow('尚未允许')
  expect(fake.tabs.sendMessage).not.toHaveBeenCalled()
})

it('表单在内嵌文档中时，不把顶层空壳当成缺项', async () => {
  fake.scripting.executeScript.mockResolvedValue([frames[0], frames[1]])
  fake.tabs.sendMessage.mockResolvedValueOnce({ result: { filled: [], uploaded: false, missing: [{ label: NO_APPLICATION_FORM, kind: 'manual' }], message: '未找到' } })
  const result = await fillTab(1, url, data)
  expect(result.filled).toEqual(['姓名'])
  expect(result.missing).toEqual([])
})
