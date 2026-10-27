import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createDirectFill, DIRECT_KEY } from './direct-fill'

const storage: Record<string, unknown> = {}
const url = 'https://example.com/apply'
const result = { filled: ['姓名'], uploaded: false, missing: [], message: '请核对' }
const input = { tabId: 7, url, data: { profile: { name: '测试人' }, attachment: null } }
const fake = {
  storage: { local: { get: vi.fn(async (_key: unknown) => structuredClone(storage)), set: vi.fn(async (data: object) => { Object.assign(storage, structuredClone(data)) }) } },
  permissions: { contains: vi.fn(async (_input: unknown) => true) },
  tabs: { get: vi.fn(async (_id: number) => ({ url })), sendMessage: vi.fn(async (_id: number, _message: unknown, _options: unknown) => ({ result })) },
  scripting: { executeScript: vi.fn(async (_input: unknown) => [{ frameId: 0, documentId: 'doc-1' }]) },
}
beforeEach(() => {
  for (const key of Object.keys(storage)) delete storage[key]
  vi.clearAllMocks(); fake.tabs.get.mockReset().mockResolvedValue({ url }); fake.permissions.contains.mockResolvedValue(true)
  fake.storage.local.set.mockReset().mockImplementation(async data => { Object.assign(storage, structuredClone(data)) })
  fake.tabs.sendMessage.mockReset().mockResolvedValue({ result }); vi.stubGlobal('chrome', fake)
})
afterEach(() => vi.unstubAllGlobals())
it('不需要岗位清单、邮箱配置或附件，直接填写当前文档并保存结果', async () => {
  const service = createDirectFill()
  expect((await service.fill(input)).run).toMatchObject({ url, status: 'done', result })
  expect(fake.tabs.sendMessage).toHaveBeenCalledWith(7, expect.objectContaining({ profile: input.data.profile, attachment: null, expectedUrl: url, answers: [] }), { documentId: 'doc-1' })
  expect(storage['website-queue:v1']).toBeUndefined()
  expect(await createDirectFill().get()).toMatchObject({ profile: input.data.profile, attachment: null, run: { status: 'done' } })
})
it('可沿用已交接的资料，之后保存与移除附件不会改写批量任务', async () => {
  const batch = { profile: { name: '旧资料' }, attachment: { name: 'resume.txt', base64: 'YQ==' }, jobs: [{ id: 'existing' }] }
  storage['website-queue:v1'] = structuredClone(batch)
  const service = createDirectFill()
  expect(await service.get()).toMatchObject({ profile: batch.profile, attachment: batch.attachment })
  await service.save({ profile: { phone: '13800138000' }, attachment: null })
  expect(await createDirectFill().get()).toMatchObject({ profile: { phone: '13800138000' }, attachment: null })
  expect(storage['website-queue:v1']).toEqual(batch)
})
it('拒绝未授权和跳转后的页面，不发送个人信息', async () => {
  fake.permissions.contains.mockResolvedValue(false)
  expect((await createDirectFill().fill(input)).run?.error).toContain('尚未允许')
  fake.permissions.contains.mockResolvedValue(true)
  fake.tabs.get.mockResolvedValueOnce({ url }).mockResolvedValueOnce({ url: 'https://other.example/' })
  expect((await createDirectFill().fill(input)).run?.error).toContain('页面已变化')
  expect(fake.tabs.sendMessage).not.toHaveBeenCalled()
})
it('保存失败时不填写；空资料不强行创建任务', async () => {
  fake.storage.local.set.mockRejectedValue(new Error('磁盘不可用'))
  await expect(createDirectFill().fill(input)).rejects.toThrow('磁盘不可用')
  expect(fake.scripting.executeScript).not.toHaveBeenCalled()
  await expect(createDirectFill().fill({ ...input, data: { profile: {}, attachment: null } })).rejects.toThrow('先填写一项')
})
it('后台填写期间不重复执行，重启后的中断任务不假报完成', async () => {
  let finish!: (value: { result: typeof result }) => void
  fake.tabs.sendMessage.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const service = createDirectFill(); const pending = service.fill(input)
  await vi.waitFor(() => expect(fake.tabs.sendMessage).toHaveBeenCalledOnce())
  expect((await service.get()).run?.status).toBe('running')
  await expect(service.fill(input)).rejects.toThrow('正在填写')
  expect((await createDirectFill().get()).run).toMatchObject({ status: 'error', error: expect.stringContaining('中断') })
  finish({ result }); await pending
  expect((storage[DIRECT_KEY] as { run: { status: string } }).run.status).toBe('done')
})
