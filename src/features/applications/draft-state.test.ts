import { describe, expect, it } from 'vitest'
import { MAX_ATTACHMENT_BYTES } from '@/domain/mail-schema'
import { applyCareerPage, draftIssues, draftPayload, markWebsiteApplication, preparationAttachment, updateDraft, validResumeAttachment, websiteLinks, type Draft } from './draft-state'

const sourceUrl = 'https://example.com/careers/frontend'
const applyUrl = 'https://example.com/apply/frontend'
function draft(changes: Partial<Draft> = {}): Draft {
  return { id: 'cece31ad-abeb-4e78-a67f-6b249e148f84', company: '示例公司', role: '前端工程师', sourceUrl, recipient: 'jobs@example.com', subject: '应聘前端工程师-张三', body: '您好，附件是我的简历。', sourceConfirmed: false, ...changes }
}
function websiteDraft(changes: Partial<Draft> = {}): Draft {
  return draft({ recipient: '', subject: '', body: '', extraction: { url: sourceUrl, title: '前端工程师', company: '示例公司', role: '前端工程师', emails: [], recommendedEmail: '', notes: [], links: [{ kind: 'apply', label: '在线申请', url: applyUrl, sourceUrl }] }, ...changes })
}

describe('投递清单状态', () => {
  it('对缺失字段和有内容但格式错误的字段给出可定位提示', () => {
    expect(draftIssues(draft({ company: '', recipient: 'not-email', body: '' }))).toEqual([
      { field: 'company', label: '缺公司' }, { field: 'recipient', label: '检查招聘邮箱' }, { field: 'body', label: '缺邮件正文' },
    ])
    expect(draftIssues(draft())).toEqual([])
  })

  it('只采用当前招聘页提取的有效在线申请地址', () => {
    const current = websiteDraft()
    expect(websiteLinks(current).map(link => link.url)).toEqual([applyUrl])
    expect(websiteLinks({ ...current, sourceUrl: 'https://example.com/careers/another' })).toEqual([])
    expect(websiteLinks({ ...current, recipient: 'jobs@example.com' })).toEqual([])
    expect(websiteLinks(websiteDraft({ extraction: { ...current.extraction!, links: [
      { kind: 'entry', url: applyUrl, label: '首页', sourceUrl },
      { kind: 'apply', url: 'javascript:alert(1)', label: '申请', sourceUrl },
      { kind: 'apply', url: 'https://name:password@example.com/apply', label: '申请', sourceUrl },
    ] } }))).toEqual([])
  })

  it('不会因为缺少邮箱就把普通官网链接当作申请入口', () => {
    expect(websiteLinks(draft({ recipient: '' }))).toEqual([])
    expect(() => markWebsiteApplication(draft({ recipient: '' }), sourceUrl, 1)).toThrow()
  })

  it('官网手动标记不产生 SMTP 状态，保留原草稿内容以供撤销', () => {
    const current = websiteDraft()
    const record = markWebsiteApplication(current, applyUrl, 1234)
    expect(record).toMatchObject({ ...current, channel: 'website', applicationUrl: applyUrl, appliedAt: 1234 })
    expect(record).not.toHaveProperty('status')
    expect(record).not.toHaveProperty('messageId')
    expect(current).not.toHaveProperty('appliedAt')
  })

  it('缺公司、缺岗位或无依据的申请地址不能手动标记', () => {
    expect(() => markWebsiteApplication(websiteDraft({ company: '' }), applyUrl, 1)).toThrow()
    expect(() => markWebsiteApplication(websiteDraft({ role: '' }), applyUrl, 1)).toThrow()
    expect(() => markWebsiteApplication(websiteDraft(), 'https://elsewhere.example/apply', 1)).toThrow()
  })

  it('发送负载不携带网页提取信息或官网手动记录字段', () => {
    const record = markWebsiteApplication(websiteDraft({ jobDescription: '熟悉 React 和 TypeScript', jobDescriptionEdited: true }), applyUrl, 1234)
    expect(Object.keys(draftPayload(record)).sort()).toEqual(['id', 'company', 'role', 'sourceUrl', 'recipient', 'subject', 'body', 'sourceConfirmed'].sort())
  })

  it('重新读取更新自动获取的岗位要求，并保留用户修改或主动清空的内容', () => {
    const page = { ...websiteDraft().extraction!, jobDescription: '熟悉 TypeScript' }
    const imported = applyCareerPage(draft(), page)
    expect(imported.jobDescription).toBe('熟悉 TypeScript')
    expect(applyCareerPage(imported, { ...page, jobDescription: '熟悉 React' }).jobDescription).toBe('熟悉 React')
    const edited = updateDraft(imported, { jobDescription: '熟悉 React，独立负责项目' })
    expect(applyCareerPage(edited, page).jobDescription).toBe('熟悉 React，独立负责项目')
    expect(applyCareerPage(updateDraft(imported, { jobDescription: '' }), page).jobDescription).toBe('')
  })

  it('切换来源链接会清除旧岗位要求，不把上一个岗位的要求带入新链接', () => {
    const imported = applyCareerPage(draft(), { ...websiteDraft().extraction!, jobDescription: '旧岗位要求' })
    expect(updateDraft(imported, { company: '修改公司' }).jobDescription).toBe('旧岗位要求')
    const changed = updateDraft(imported, { sourceUrl: 'https://example.com/another' })
    expect(changed.jobDescription).toBe('')
    expect(changed.extraction).toBeUndefined()
    expect(changed.jobDescriptionEdited).toBe(false)
  })
})

describe('简历附件复用', () => {
  it('历史岗位优先复用保存的文件版本，缺失时明确退回当前附件', () => {
    const original = new File(['发送时版本'], 'resume.txt')
    const current = new File(['修改后版本'], 'resume.txt')
    const source = { id: 'document-old', updatedAt: 123 }
    expect(preparationAttachment({ jobDescription: 'React', attachment: original, attachmentSource: source, attachmentUse: 'mail' }, current, { id: 'document-new', updatedAt: 456 })).toEqual({ file: original, source, use: 'mail', saved: true })
    expect(preparationAttachment({ jobDescription: 'React' }, current)).toMatchObject({ file: current, saved: false })
    expect(preparationAttachment({ jobDescription: 'React', attachment: new File([], 'missing.txt') }, current)).toMatchObject({ file: current, saved: false })
    expect(preparationAttachment(undefined, null)).toMatchObject({ file: null, saved: false })
  })

  it('仅接受规则允许的真实、非空文件', () => {
    expect(validResumeAttachment(new File(['原文件'], 'resume.PDF'))).toBe(true)
    expect(validResumeAttachment(new File(['原文件'], 'resume.docx'))).toBe(true)
    expect(validResumeAttachment(new File(['原文件'], 'resume.txt'))).toBe(true)
    expect(validResumeAttachment(new File([], 'resume.pdf'))).toBe(false)
    expect(validResumeAttachment(new File(['原文件'], 'resume.md'))).toBe(false)
    expect(validResumeAttachment({ name: 'resume.pdf', size: 123 })).toBe(false)
    expect(validResumeAttachment(new Blob(['原文件']))).toBe(false)
  })

  it('拒绝超出邮件限制的附件', () => {
    expect(validResumeAttachment(new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], 'resume.pdf'))).toBe(false)
  })
})
