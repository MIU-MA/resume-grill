import { describe, expect, it } from 'vitest'
import { batchSchema } from '@/domain/mail-schema'
import { prepareQuickMail } from './quick-mail'
import { initialMailDefaults } from './mail-defaults'
import { draftIssues, draftPayload, updateDraft } from './draft-state'
import { parseContactList, planContactImports } from './contact-import'

const defaults = { ...initialMailDefaults(), sender: { provider: 'qq' as const, name: '张三', address: 'candidate@qq.com' } }

describe('只填收件邮箱', () => {
  it('生成无占位符的邮件并通过真正的发送协议校验', () => {
    const { draft } = prepareQuickMail(' HR@Example.com ', [], defaults)
    expect(draft).toMatchObject({ company: '', role: '', sourceUrl: '', recipient: 'hr@example.com', subject: '求职申请-张三' })
    expect(draft.body).toContain('附件是我的简历，供您参考。')
    expect(draft.body).not.toMatch(/岗位名称|相关岗位|姓名/)
    expect(draftIssues(draft)).toEqual([])
    const batch = { id: crypto.randomUUID(), sender: defaults.sender, jobs: [draftPayload(draft)], attachment: { name: 'resume.txt', base64: 'dGVzdA==' } }
    // Sender provider belongs to settings, not the transport contract.
    const { provider: _provider, ...sender } = defaults.sender
    expect(batchSchema.safeParse({ ...batch, sender }).success).toBe(true)
    expect(batchSchema.safeParse({ ...batch, sender, jobs: [{ ...draftPayload(draft), recipient: 'invalid' }] }).success).toBe(false)
    expect(batchSchema.safeParse({ ...batch, sender, jobs: [{ ...draftPayload(draft), company: 'a\nb' }] }).success).toBe(false)
  })

  it('反复预览复用同一草稿，保留手写邮件，不覆盖具体岗位', () => {
    const first = prepareQuickMail('hr@example.com', [], defaults)
    const manual = updateDraft(first.draft, { subject: '自定义主题', body: '手写正文' })
    const next = prepareQuickMail('HR@example.com', [manual], defaults)
    expect(next.drafts).toEqual([manual])
    const specific = { ...manual, role: '开发工程师' }
    expect(prepareQuickMail('hr@example.com', [specific], defaults).drafts).toHaveLength(2)
    expect(() => prepareQuickMail('invalid', [], defaults)).toThrow()
    expect(() => prepareQuickMail('new@example.com', Array(20).fill(specific), defaults)).toThrow('清单已满')
  })

  it('未设置发件人时仍保存邮箱，自定义模板继续生效', () => {
    expect(prepareQuickMail('hr@example.com', [], initialMailDefaults()).draft).toMatchObject({ recipient: 'hr@example.com', subject: '', body: '' })
    expect(prepareQuickMail('hr@example.com', [], { ...defaults, subject: '{{姓名}}的简历', body: '请查收附件。' }).draft).toMatchObject({ subject: '张三的简历', body: '请查收附件。' })
  })

  it('只粘贴邮箱的名单可以导入、去重，不编造公司或岗位', () => {
    const contacts = parseContactList('hr@example.com\nHR@example.com\nother@example.com')
    const result = planContactImports(contacts, [], 20)
    expect(result.duplicates).toBe(1)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({ company: '', role: '', sourceUrl: '', recipient: 'hr@example.com' })
  })
})
