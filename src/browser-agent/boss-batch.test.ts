import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createBossBatch } from './boss-batch'

const directories: string[] = []
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (!/^boss-concurrent-test-[^\\/]+$/.test(relative(resolve(tmpdir()), resolve(directory)))) throw new Error('测试目录无效')
    await rm(directory, { recursive: true, force: true })
  }
})

it('两个执行器同时确认同一岗位，只有一个能点击沟通', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'boss-concurrent-test-'))
  directories.push(directory)
  const job = { url: 'https://www.zhipin.com/job_detail/concurrent.html', title: '开发实习', company: '测试公司', greeting: '草稿' }
  const bothOpened = Promise.withResolvers<void>()
  const contact = vi.fn()
  let pages = 0
  const browser = {
    isConnected: () => true,
    ownedChatPopup: async () => undefined,
    withJobPage: async (_url: string, _source: unknown, read: (value: unknown) => Promise<void>) => {
      let opened = false
      if (++pages === 2) bothOpened.resolve()
      await bothOpened.promise
      return read({
        isClosed: () => false,
        evaluate: async (_fn: unknown, input?: { action: string }) => {
          if (!input) return { ...job, kind: 'detail', description: '完整 JD', truncated: false, communication: { labels: ['立即沟通'], count: 1, enabled: 1 } }
          if (input.action === 'contact') { contact(); opened = true }
          return { url: job.url, editors: Number(opened), sendButtons: Number(opened), jobLinks: [], outgoingTexts: opened ? [{ id: 'new-greeting', text: '官网招呼', delivered: true }] : [] }
        },
      })
    },
  }
  const current = (() => ({ browser, source: { browserContextId: () => 'fixture' } })) as unknown as Parameters<typeof createBossBatch>[1]
  const agents = [createBossBatch(directory, current, vi.fn()), createBossBatch(directory, current, vi.fn())]
  try {
    const previews = await Promise.all(agents.map(agent => agent.preview({ id: randomUUID(), jobs: [job], images: [] })))
    await Promise.all(agents.map((agent, index) => agent.confirm(previews[index].id, true, true)))
    // Each agent has already passed its own journal check when both pages are opened.
    await vi.waitFor(() => expect(pages).toBe(2))
    await vi.waitFor(async () => {
      const runs = await Promise.all(agents.map((agent, index) => agent.status(previews[index].batchId)))
      expect(runs.map(run => run.state).sort()).toEqual(['finished', 'paused'])
    })
    expect(contact).toHaveBeenCalledTimes(1)
    await expect(agents[0].preview({ id: randomUUID(), jobs: [job], images: [] })).rejects.toThrow('已有联系记录')
  } finally {
    bothOpened.resolve()
    await Promise.all(agents.map(agent => agent.close()))
  }
})

it('同一批次的第二份预览返回原结果，并释放执行器占用', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'boss-concurrent-test-'))
  directories.push(directory)
  const open = vi.fn(async () => { throw new Error('详情页关闭') })
  const context = { browser: { isConnected: () => true, withJobPage: open }, source: { browserContextId: () => 'fixture' } }
  let busy = false
  const current = (() => busy ? undefined : context) as unknown as Parameters<typeof createBossBatch>[1]
  const agent = createBossBatch(directory, current, value => { busy = value })
  const input = { id: randomUUID(), jobs: [{ url: 'https://www.zhipin.com/job_detail/replay.html', title: '实习', company: '测试公司', greeting: '草稿' }], images: [] }
  try {
    const first = await agent.preview(input), second = await agent.preview(input)
    await agent.confirm(first.id, true, true)
    await vi.waitFor(async () => expect((await agent.status(input.id)).state).toBe('paused'))
    expect((await agent.confirm(second.id, true, true)).state).toBe('paused')
    expect(busy).toBe(false)
    expect(open).toHaveBeenCalledTimes(1)
  } finally { await agent.close() }
})
