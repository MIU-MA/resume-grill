import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { reconnectOpenWorkbenches } from './workbench-recovery'

afterEach(() => vi.unstubAllGlobals())
it('本机通信是必需权限，招聘网站仍逐站授权', () => {
  const manifest = JSON.parse(readFileSync('src/browser-extension/manifest.json', 'utf8'))
  expect(manifest.host_permissions).toEqual(['http://localhost/*', 'http://127.0.0.1/*'])
  expect(manifest.optional_host_permissions).toEqual(['https://*/*'])
  expect(manifest.content_scripts[0].matches).toEqual(manifest.host_permissions)
})
it('安装更新后仅恢复已授权的本机工作台，不注入外站、API 或其他端口', async () => {
  const tabs = [{ id: 1, url: 'http://localhost:3000/diagnosis' }, { id: 2, url: 'http://127.0.0.1:3107/applications' }, { id: 3, url: 'https://example.com/applications' }, { id: 4, url: 'http://localhost:3000/api/status' }, { id: 5, url: 'http://localhost:8000/applications' }]
  const contains = vi.fn(async ({ origins }: { origins: string[] }) => origins[0] === 'http://localhost/*')
  const executeScript = vi.fn(async () => [])
  vi.stubGlobal('chrome', { tabs: { query: vi.fn(async () => tabs) }, permissions: { contains }, scripting: { executeScript } })
  await reconnectOpenWorkbenches()
  expect(contains.mock.calls.map(call => call[0].origins)).toEqual([['http://localhost/*'], ['http://127.0.0.1/*']])
  expect(executeScript).toHaveBeenCalledExactlyOnceWith({ target: { tabId: 1, frameIds: [0] }, files: ['bridge.js'] })
})
it('一个标签页关闭或注入失败，不影响其他工作台恢复', async () => {
  const executeScript = vi.fn().mockRejectedValueOnce(new Error('tab closed')).mockResolvedValue([])
  vi.stubGlobal('chrome', { tabs: { query: vi.fn(async () => [{ id: 1, url: 'http://localhost:3000/' }, { id: 2, url: 'http://localhost:3107/' }]) }, permissions: { contains: vi.fn(async () => true) }, scripting: { executeScript } })
  const results = await reconnectOpenWorkbenches()
  expect(results.map(result => result.status)).toEqual(['rejected', 'fulfilled'])
  expect(executeScript).toHaveBeenCalledTimes(2)
})
