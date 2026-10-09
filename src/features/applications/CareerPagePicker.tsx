'use client'

import type { CareerPage } from '@/domain/mail-schema'
import { Button } from '@/components/ui/Button'
import { availableCareerJobs, selectCareerJob } from './career-selection'

export function CareerPagePicker({ pages, existing, disabled, filter = '', onChoose }: {
  pages: CareerPage[]; existing: Array<{ sourceUrl: string; role: string }>; disabled: boolean; filter?: string
  onChoose: (page: CareerPage) => void
}) {
  return <div className="mt-3 max-h-[240px] overflow-auto divide-y divide-line border border-line" aria-label="网页中的岗位">
    {pages.map(page => {
      const available = availableCareerJobs(page, existing)
      const jobs = (page.jobs?.length ? page.jobs : [{ id: '', role: page.role }]).filter(job => `${page.company} ${job.role}`.toLowerCase().includes(filter.toLowerCase()))
      return jobs.length ? <div key={page.url} className="px-3 py-2">
        <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-text-tertiary underline">{page.company || page.title || new URL(page.url).hostname} · 官网来源</a>
        {jobs.map(job => {
          const added = job.id ? !available.some(item => item.id === job.id) : existing.some(item => item.sourceUrl === page.url && item.role === job.role)
          const chosen = job.id ? selectCareerJob(page, job.id) : page
          return <div key={job.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1"><span className="text-[12px] font-medium">{job.role}</span><span className="mt-1 block text-[11px] text-text-tertiary">{chosen.recommendedEmail || '邮箱待核对'}</span></div>
            <Button variant="secondary" className="h-7 shrink-0 px-2 text-[11px]" disabled={disabled || added} onClick={() => onChoose(chosen)}>{added ? '已加入' : '加入清单'}</Button>
          </div>
        })}
      </div> : null
    })}
  </div>
}
