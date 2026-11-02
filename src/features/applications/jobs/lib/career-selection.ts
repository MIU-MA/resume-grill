import type { CareerJob, CareerPage } from '@/domain/mail-schema'

export function selectCareerJob(page: CareerPage, jobId: string): CareerPage {
  const job = page.jobs?.find(item => item.id === jobId)
  if (!job) throw new Error('岗位已变化，请重新读取招聘页。')
  // Job-specific contacts take priority. A shared, unambiguous hiring contact is
  // usable only when the job itself did not expose conflicting contacts.
  const recommendedEmail = job.recommendedEmail || (job.emailAmbiguous ? '' : page.recommendedEmail)
  const company = job.company || page.company
  const contacts = job.emails.length ? job.emails : page.emails
  const emails = new Map([...page.emails.filter(item => item.email === recommendedEmail), ...contacts].map(item => [item.email, item]))
  return { ...page, company, role: job.role,
    emails: [...emails.values()], recommendedEmail,
    jobDescription: job.jobDescription,
    notes: page.notes.filter(note => !/多个岗位|单一岗位|岗位详情链接/.test(note)
      && (!company || !note.includes('未识别到公司名称'))
      && (!recommendedEmail || !/多个可能的招聘邮箱|未识别到明确的招聘邮箱/.test(note))),
  }
}

export function availableCareerJobs(page: CareerPage, existing: Array<{ sourceUrl: string; role: string }>): CareerJob[] {
  return (page.jobs ?? []).filter(job => !existing.some(item => item.sourceUrl === page.url && item.role === job.role))
}
