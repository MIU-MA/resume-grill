import { describe, expect, it } from 'vitest'
import { applyMailDefaults, initialMailDefaults, mailDefaultsSchema, renderMailTemplate, restoreMailDefaults, senderDefaults } from './mail-defaults'
import { updateDraft, type Draft } from './draft-state'

const draft: Draft = { id: 'cece31ad-abeb-4e78-a67f-6b249e148f84', company: '甲公司', role: '前端工程师', recipient: 'hr@example.com', sourceUrl: '', subject: '', body: '', sourceConfirmed: false, automatic: true }
const defaults = { ...initialMailDefaults(), sender: { provider: 'qq' as const, name: '张三', address: 'candidate@qq.com' } }

describe('默认投递设置', () => {
  it('未连接 SMTP 也能生成草稿，不添加未经提供的经历', () => {
    expect(renderMailTemplate(defaults, draft)).toMatchObject({ subject: '应聘前端工程师-张三' })
    expect(renderMailTemplate(defaults, draft)?.body).toContain('甲公司的前端工程师')
    expect(renderMailTemplate(initialMailDefaults(), draft)).toBeNull()
  })

  it('已连接邮箱的实际身份优先，支持中英文变量，不递归解释替换值', () => {
    const template = { ...defaults, subject: '{{role}}-{{姓名}}', body: '{{公司}} / {{name}} / {{email}}' }
    expect(renderMailTemplate(template, { ...draft, company: '{{姓名}}公司' }, { name: '李四', address: 'other@163.com' })).toEqual({ subject: '前端工程师-李四', body: '{{姓名}}公司 / 李四 / other@163.com' })
  })

  it('保存设置不接受授权码和未知字段，旧存储使用默认值', () => {
    expect(restoreMailDefaults(undefined)).toEqual(initialMailDefaults())
    expect(mailDefaultsSchema.safeParse({ ...defaults, authorizationCode: 'secret' }).success).toBe(false)
    expect(mailDefaultsSchema.safeParse({ ...defaults, sender: { ...defaults.sender, authorizationCode: 'secret' } }).success).toBe(false)
    expect(senderDefaults(defaults, { name: '李四', address: 'other@163.com' }).sender).toEqual({ provider: '163', name: '李四', address: 'other@163.com' })
    expect(senderDefaults(defaults, { name: '李四', address: 'Other@163.COM' }).sender.provider).toBe('163')
  })

  it('拒绝未知变量、不完整括号、主题换行和非法邮箱', () => {
    for (const subject of ['{{学校}}', '{{姓名}', '{{}}', '应聘\n{{姓名}}']) expect(mailDefaultsSchema.safeParse({ ...defaults, subject }).success).toBe(false)
    expect(mailDefaultsSchema.safeParse({ ...defaults, sender: { ...defaults.sender, address: 'invalid' } }).success).toBe(false)
  })

  it('模板变动只更新自动邮件；手工正文和主动清空都保留', () => {
    const generated = applyMailDefaults([draft], defaults)[0]
    const edited = updateDraft(generated, { body: '我自己写的正文' })
    const cleared = updateDraft(generated, { subject: '' })
    const changed = { ...defaults, subject: '新主题-{{姓名}}' }
    expect(applyMailDefaults([edited, cleared], changed)).toEqual([edited, cleared])
    expect(applyMailDefaults([generated], changed)[0].subject).toBe('新主题-张三')
  })

  it('明确重新套用模板后恢复自动更新；内容不变保留数组引用', () => {
    const manual = updateDraft(draft, { body: '手写内容' })
    const reset = updateDraft(manual, { ...renderMailTemplate(defaults, draft)!, automatic: true })
    expect(reset.automatic).toBe(true)
    const current = [reset]
    expect(applyMailDefaults(current, defaults)).toBe(current)
    expect(applyMailDefaults(current, defaults, { name: '李四', address: 'other@qq.com' })[0].subject).toContain('李四')
  })
})
