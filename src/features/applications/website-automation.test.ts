// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { extensionRequest, makeWebsiteBatch, seedWebsiteProfile, websiteTargets } from './website-automation'
import { websiteBatchSchema, isWorkbenchUrl } from '@/domain/website-automation'
import type { Draft } from './draft-state'

const draft = (extra: Partial<Draft> = {}): Draft => ({ id: crypto.randomUUID(), company: '示例公司', role: '前端工程师', sourceUrl: 'https://example.com/jobs/1', recipient: '', body: '', subject: '', sourceConfirmed: false, ...extra })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('工作台与官网填写交接', () => {
  it('只带入有公司岗位的官网条目，邮箱岗位继续走原有发送流程', () => {
    const kept = draft()
    expect(websiteTargets([kept, draft({ recipient: 'jobs@example.com' }), draft({ company: '' }), draft({ sourceUrl: 'javascript:alert(1)' })]).map(item => item.draft.id)).toEqual([kept.id])
  })
  it('多入口要求用户选择，不默取第一条；只允许原招聘页给出的入口', async () => {
    const item = draft(); item.extraction = { url: item.sourceUrl, company: item.company, role: item.role, title: '', notes: [], emails: [], recommendedEmail: '', links: ['a', 'b'].map(suffix => ({ kind: 'apply', label: suffix, sourceUrl: item.sourceUrl, url: `https://example.com/apply/${suffix}` })) }
    const file = new File(['简历'], 'resume.txt')
    await expect(makeWebsiteBatch([item], {}, {}, file)).rejects.toThrow('选择申请入口')
    await expect(makeWebsiteBatch([item], { [item.id]: 'https://evil.example/form' }, {}, file)).rejects.toThrow('选择申请入口')
    const batch = await makeWebsiteBatch([item], { [item.id]: 'https://example.com/apply/b' }, { name: '林同学' }, file)
    expect(batch.jobs[0].url).toBe('https://example.com/apply/b')
    expect(atob(batch.attachment.base64)).not.toBe('')
    expect(batch).not.toHaveProperty('apiKey')
  })
  it('资料复用明确标注的字段，多个电话不猜，不从简历推断姓名', () => {
    expect(seedWebsiteProfile('姓名：林同学\n学校：示例大学\n手机号：13800138000')).toMatchObject({ name: '林同学', school: '示例大学', phone: '13800138000' })
    const profile = seedWebsiteProfile('随意一段项目介绍\n13800138000 13900139000', { name: '已保存姓名', address: 'lin@example.com' })
    expect(profile).toMatchObject({ name: '已保存姓名', email: 'lin@example.com' }); expect(profile.phone).toBeUndefined()
  })
  it('损坏附件、重复岗位和超过容量的请求不能交接', async () => {
    await expect(makeWebsiteBatch([draft()], {}, {}, new File(['x'], 'script.js'))).rejects.toThrow('简历')
    const item = draft(); const batch = await makeWebsiteBatch([item], {}, {}, new File(['x'], 'resume.txt'))
    expect(websiteBatchSchema.safeParse({ ...batch, jobs: [batch.jobs[0], batch.jobs[0]] }).success).toBe(false)
    expect(websiteBatchSchema.safeParse({ ...batch, jobs: Array.from({ length: 21 }, () => ({ ...batch.jobs[0], id: crypto.randomUUID() })) }).success).toBe(false)
  })
  it('消息只接受同窗口、同来源和本次请求的响应', async () => {
    // jsdom's default URL is localhost:3000, the supported local workbench.
    const post = vi.spyOn(window, 'postMessage').mockImplementation(() => undefined)
    const pending = extensionRequest<{ version: number }>('ping')
    const request = post.mock.calls[0][0] as { requestId: string }
    let settled = false; void pending.then(() => { settled = true })
    const reply = { channel: 'resume-grill.website.response', requestId: request.requestId, response: { ok: true, data: { version: 1 } } }
    window.dispatchEvent(new MessageEvent('message', { data: reply, source: window, origin: 'https://evil.example' }))
    window.dispatchEvent(new MessageEvent('message', { data: { ...reply, requestId: 'other' }, source: window, origin: location.origin }))
    await Promise.resolve(); expect(settled).toBe(false)
    window.dispatchEvent(new MessageEvent('message', { data: reply, source: window, origin: location.origin }))
    expect(await pending).toEqual({ version: 1 })
    expect(isWorkbenchUrl('https://example.com/applications')).toBe(false)
    expect(isWorkbenchUrl('http://localhost:3000.evil.test/applications')).toBe(false)
    expect(isWorkbenchUrl('http://127.0.0.1:3107/applications')).toBe(true)
  })
})
