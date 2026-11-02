import { createServer } from 'node:http'
import { expect, it, vi } from 'vitest'
import { createAgentHandler, allowedOrigins } from './server'
import { discoverRecruitingPage, readRecruitingDetail } from './career-reader'
import type { MailQueue } from './queue'
vi.mock('./career-reader', () => ({ discoverRecruitingPage: vi.fn(), readRecruitingDetail: vi.fn() }))
it('工作台发现与详情接口接入新读取器，岗位方向原样传递，不会再落回旧的静态入口', async () => {
  const page = { url: 'https://jobs.bytedance.com/experienced/position/123/detail', company: '字节跳动', role: '后端研发', jobDescription: '岗位职责：开发服务。任职要求：熟悉 Java。', title: '后端研发', emails: [], recommendedEmail: '', notes: [] }
  vi.mocked(discoverRecruitingPage).mockResolvedValue({ links: [], pages: [page], pagesRead: 1, notes: [], listingRead: true })
  vi.mocked(readRecruitingDetail).mockResolvedValue(page)
  const queue = { snapshot: () => ({ jobs: [], sender: null, running: false, paused: true }) } as unknown as MailQueue
  const options = { token: 'TEST-ONLY-PAIRING', origins: allowedOrigins(), queue: () => queue, port: 0 }
  const server = createServer(createAgentHandler(options))
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('测试端口未启动')
  options.port = address.port
  const post = (path: string, body: unknown) => fetch(`http://127.0.0.1:${address.port}${path}`, { method: 'POST', headers: { Origin: 'http://127.0.0.1:3107', Authorization: 'Bearer TEST-ONLY-PAIRING', 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  try {
    const result = await post('/discover', { url: 'https://jobs.bytedance.com/', keywords: ['后端', 'Backend'] })
    expect(result.status).toBe(200)
    expect((await result.json()).pages[0].jobDescription).toContain('Java')
    expect(discoverRecruitingPage).toHaveBeenCalledWith('https://jobs.bytedance.com/', ['后端', 'Backend'])
    expect((await post('/extract', { url: page.url })).status).toBe(200)
    expect(readRecruitingDetail).toHaveBeenCalledWith(page.url)
  } finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())) }
})
