import { describe, expect, it } from 'vitest'
import { extractCareerEmails } from '@/mail-agent/public-page'
import { availableCareerJobs, selectCareerJob } from './career-selection'
import { applyMailDefaults, initialMailDefaults } from './mail-defaults'
import { applyCareerPage, type Draft } from './draft-state'

describe('官网岗位带入', () => {
  const page = extractCareerEmails('<article><h3>前端工程师</h3><h4>岗位职责</h4><p>开发 React 页面。</p><p>投递简历 frontend@example.com</p></article><article><h3>后端工程师</h3><h4>任职要求</h4><p>熟悉 Java。</p><p>投递简历 backend@example.com</p></article>', 'https://www.jienor.com/join/')
  it('fills the selected job without taking another job’s description or mailbox', () => {
    const chosen = selectCareerJob(page, page.jobs![0].id)
    expect(chosen).toMatchObject({ company: '杰诺科技', role: '前端工程师', recommendedEmail: 'frontend@example.com', jobDescription: '岗位职责\n开发 React 页面。' })
    expect(chosen.notes.some(note => /多个岗位|单一岗位/.test(note))).toBe(false)
    expect(chosen.notes.some(note => /多个可能的招聘邮箱/.test(note))).toBe(false)
    expect(chosen.emails.map(item => item.email)).toEqual(['frontend@example.com'])
    const draft: Draft = { id: 'draft', company: chosen.company, role: chosen.role, recipient: chosen.recommendedEmail,
      sourceUrl: chosen.url, subject: '', body: '', automatic: true, sourceConfirmed: false }
    const defaults = initialMailDefaults()
    defaults.sender.name = '林同学'
    const [filled] = applyMailDefaults([draft], defaults)
    expect(filled.subject).toContain('前端工程师')
    expect(filled.body).toContain('杰诺科技')
    expect(filled.body).not.toContain('后端工程师')
  })
  it('uses one shared hiring address for a tabbed job without its own contact', () => {
    const tabbed = extractCareerEmails('<button role="tab" aria-controls="p1">前端工程师</button><button role="tab" aria-controls="p2">后端工程师</button><div role="tabpanel" id="p1"><h3>任职要求</h3><p>React。</p></div><div role="tabpanel" id="p2" hidden><h3>任职要求</h3><p>Java。</p></div><p>简历发 hr@example.com</p>', 'https://example.com/jobs')
    expect(selectCareerJob(tabbed, tabbed.jobs![0].id).recommendedEmail).toBe('hr@example.com')
    expect(selectCareerJob(tabbed, tabbed.jobs![1].id).jobDescription).toBe('任职要求\nJava。')
  })
  it('keeps a job’s conflicting contacts empty even when a shared address exists', () => {
    const ambiguous = { ...page, recommendedEmail: 'hr@example.com', jobs: [{ ...page.jobs![0], emailAmbiguous: true, recommendedEmail: '' }] }
    expect(selectCareerJob(ambiguous, ambiguous.jobs[0].id).recommendedEmail).toBe('')
  })
  it('lets users add another job from the same page without duplicating a chosen job', () => {
    const available = availableCareerJobs(page, [{ sourceUrl: page.url, role: '前端工程师' }])
    expect(available.map(job => job.role)).toEqual(['后端工程师'])
    expect(() => selectCareerJob(page, 'missing')).toThrow('重新读取')
  })
  it('re-reading a shared page retains the chosen job’s requirements and recipient', () => {
    const chosen = selectCareerJob(page, page.jobs![0].id)
    const draft: Draft = { id: 'draft', company: chosen.company, role: chosen.role, recipient: chosen.recommendedEmail,
      sourceUrl: chosen.url, subject: '', body: '', automatic: true, sourceConfirmed: false,
      extraction: chosen, jobDescription: chosen.jobDescription }
    const updated = { ...page, jobs: page.jobs!.map((job, i) => i ? job : { ...job, jobDescription: '任职要求\n熟悉 TypeScript。' }) }
    expect(applyCareerPage(draft, updated)).toMatchObject({ role: '前端工程师', recipient: 'frontend@example.com', jobDescription: '任职要求\n熟悉 TypeScript。' })
    expect(applyCareerPage({ ...draft, jobDescription: '', jobDescriptionEdited: true }, updated).jobDescription).toBe('')
  })
})
