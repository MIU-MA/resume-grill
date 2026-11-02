import { describe, expect, it } from 'vitest'
import type { MailJob } from '@/domain/mail-schema'
import { emptyApplicationProgress } from '@/domain/application-progress'
import { applicationEntryChannel, applicationEntrySearchText, applicationEntryStage, buildApplicationEntries } from './application-entry'
import type { WebsiteApplication } from './draft-state'

const mail = { id: 'm1', company: '邮件公司', role: '前端', recipient: 'hr@mail.com', sourceUrl: '', createdAt: 1, updatedAt: 4, status: 'sent' } as MailJob
const website = { id: 'w1', company: '官网公司', role: '后端', recipient: 'hr@site.com', sourceUrl: 'https://site.example/job', applicationUrl: 'https://site.example/job', appliedAt: 2, channel: 'website' } as WebsiteApplication
const manual = { id: 'a1', company: '手动公司', role: '运营', channel: 'referral' as const, appliedAt: 3, sourceUrl: 'https://example.com/job', contact: '朋友', note: '', createdAt: 3, updatedAt: 3 }

describe('投递记录适配', () => {
  it('合并邮件、官网和手动记录，并过滤本地隐藏的邮件', () => {
    const entries = buildApplicationEntries({ jobs: [mail], websites: [website], manuals: [manual] })
    expect(entries.map(entry => entry.kind).sort()).toEqual(['mail', 'manual', 'website'])
    expect(applicationEntryChannel(entries.find(entry => entry.kind === 'manual')!)).toBe('内推')
    expect(buildApplicationEntries({ jobs: [mail], hiddenJobIds: ['m1'] })).toHaveLength(0)
  })

  it('没有进展时按渠道给出默认阶段，搜索文本覆盖公司、岗位和联系方式', () => {
    const entries = buildApplicationEntries({ jobs: [mail], websites: [website], manuals: [manual] })
    const mailEntry = entries.find(entry => entry.kind === 'mail')!
    expect(applicationEntryStage(mailEntry)).toBe('awaiting')
    expect(applicationEntryStage(mailEntry, emptyApplicationProgress())).toBe('awaiting')
    expect(applicationEntrySearchText(entries.find(entry => entry.kind === 'manual')!)).toContain('手动公司')
    expect(applicationEntrySearchText(entries.find(entry => entry.kind === 'website')!)).toContain('hr@site.com')
  })
})
