import { describe, expect, it } from 'vitest'
import type { CareerPage } from '@/domain/mail-schema'
import type { Draft } from './draft-state'
import { initialMailDefaults } from './mail-defaults'
import { prepareAssistantDrafts } from './assistant-drafts'

const page: CareerPage = { url: 'https://example.com/jobs/1', company: '示例公司', role: '前端工程师', title: '', emails: [], recommendedEmail: '', notes: [], jobDescription: '熟悉 React' }
const existing: Draft = { id: 'old', sourceUrl: page.url, company: page.company, role: page.role, subject: '手动主题', body: '手动正文', recipient: '', sourceConfirmed: true }

describe('求职助手准备投递草稿', () => {
  it('只为新岗位套用已有模板，不改旧邮件，不猜邮箱或确认来源', () => {
    const defaults = initialMailDefaults()
    defaults.sender.name = '林同学'
    const additions = prepareAssistantDrafts([{ ...page, url: 'https://example.com/jobs/2' }], [existing], defaults)
    expect(additions[0]).toMatchObject({ company: '示例公司', role: '前端工程师', subject: '应聘前端工程师-林同学', recipient: '', sourceConfirmed: false, jobDescription: '熟悉 React' })
    expect(existing.subject).toBe('手动主题')
    expect(existing.body).toBe('手动正文')
  })
  it('按岗位和规范化链接去重，手动填写中的无效链接不阻止导入', () => {
    expect(prepareAssistantDrafts([{ ...page, url: `${page.url}#section` }], [existing], initialMailDefaults())).toEqual([])
    const additions = prepareAssistantDrafts([page, page, { ...page, role: '高级前端工程师' }], [{ ...existing, sourceUrl: '尚未填完' }], initialMailDefaults())
    expect(additions).toHaveLength(2)
    expect(additions[0].subject).toBe('')
  })
  it('超出清单容量则整体拒绝，不留下部分新增草稿', () => {
    const full = Array.from({ length: 20 }, (_, index) => ({ ...existing, id: String(index) }))
    expect(() => prepareAssistantDrafts([{ ...page, role: '新前端岗位' }], full, initialMailDefaults())).toThrow('还能添加 0')
    expect(full).toHaveLength(20)
  })
})
