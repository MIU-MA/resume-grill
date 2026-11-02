'use client'

import { useMemo, useState } from 'react'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { useSessionState } from '@/hooks/use-session-state'
import { careerSites } from '@/data/career-sites'
import { seedJobs } from '@/data/job-catalog'
import type { CareerDiscovery, CareerPage } from '@/domain/mail-schema'
import { careerJobRows, careerSiteKey, DIRECTION_LABELS, EMPLOYMENT_LABELS, inferDirection, inferEmployment, type CareerJobRow, type EmploymentType, type JobDirection } from './lib/career-jobs'
import { CareerPagePicker } from './CareerPagePicker'
import { useCareerJobs } from './hooks/use-career-jobs'
import { careerUrlKey } from './lib/pasted-career'
import { savedDate } from '../mail/lib/mail-presentation'

function sameJob(a: { sourceUrl: string; role: string }, row: CareerJobRow) {
  try {
    if (careerUrlKey(a.sourceUrl) !== careerUrlKey(row.url)) return false
    return row.kind === 'link' || a.role === row.role
  } catch { return a.sourceUrl === row.url && (row.kind === 'link' || a.role === row.role) }
}
function hostname(url: string) {
  try { return new URL(url).hostname } catch { return '官网' }
}
function siteKeyOf(url: string) {
  try { return careerSiteKey(url) } catch { return url }
}

export function CareerJobsView({ connected, existingJobs, slots, discover, read, onConnect, onBusy, onError, onImported, onOpenApplications }: {
  connected: boolean
  existingJobs: Array<{ sourceUrl: string; role: string }>
  slots: number
  discover: (url: string) => Promise<CareerDiscovery>
  read: (url: string) => Promise<CareerPage>
  onConnect: () => void
  onBusy: (busy: boolean) => void
  onError: (message: string) => void
  onImported: (page: CareerPage) => void
  onOpenApplications: () => void
}) {
  const careers = useCareerJobs({ discover, read, connected, onConnect, onBusy, onError })
  const [sourceOpen, setSourceOpen] = useState(false)
  const [sourceQuery, setSourceQuery] = useState('')
  const [jobQuery, setJobQuery] = useSessionState('careers-job-query', '', (value): value is string => typeof value === 'string')
  const [company, setCompany] = useSessionState('careers-company', '', (value): value is string => typeof value === 'string')
  const [employment, setEmployment] = useSessionState<'all' | EmploymentType>('careers-employment', 'all', (value): value is 'all' | EmploymentType => value === 'all' || value === 'campus' || value === 'social' || value === 'unknown')
  const [direction, setDirection] = useSessionState<'all' | JobDirection>('careers-direction', 'all', (value): value is 'all' | JobDirection => value === 'all' || (typeof value === 'string' && value in DIRECTION_LABELS))
  const [onlyUnadded, setOnlyUnadded] = useSessionState('careers-unadded', false, (value): value is boolean => typeof value === 'boolean')
  const [adding, setAdding] = useState<string | null>(null)
  const [pickerPages, setPickerPages] = useState<CareerPage[]>([])
  const rows = useMemo(() => {
    const cached = careerJobRows(careers.store)
    const seen = new Set(cached.map(row => `${row.url}\n${row.role}`))
    const seeded = seedJobs
      .filter(job => !seen.has(`${job.url}\n${job.role}`))
      .map(job => ({
        id: `seed:${job.url}\n${job.role}`,
        company: job.company,
        role: job.role,
        url: job.url,
        sourceUrl: job.sourceUrl,
        email: job.email,
        fetchedAt: job.fetchedAt,
        siteUrl: job.sourceUrl,
        kind: 'page' as const,
        employment: inferEmployment(job.role, job.url, job.sourceUrl),
        direction: inferDirection(job.role, job.url, job.sourceUrl),
        page: {
          url: job.url,
          title: job.role,
          company: job.company,
          role: job.role,
          emails: job.email ? [{ email: job.email, context: '预置职位快照' }] : [],
          recommendedEmail: job.email,
          notes: ['来自仓库预置的公开职位快照。'],
          links: [],
        },
      }))
    return [...cached, ...seeded].sort((a, b) => b.fetchedAt - a.fetchedAt || a.company.localeCompare(b.company, 'zh-CN') || a.role.localeCompare(b.role, 'zh-CN'))
  }, [careers.store])
  const rowsBySite = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of rows) { const key = siteKeyOf(row.siteUrl); map.set(key, (map.get(key) ?? 0) + 1) }
    return map
  }, [rows])
  const seedBySite = useMemo(() => {
    const map = new Map<string, number>()
    for (const job of seedJobs) { const key = siteKeyOf(job.sourceUrl); map.set(key, (map.get(key) ?? 0) + 1) }
    return map
  }, [])
  const readCompanies = useMemo(() => {
    const seen = new Map<string, string>()
    for (const row of rows) seen.set(siteKeyOf(row.siteUrl), row.company)
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], 'zh-CN'))
  }, [rows])
  const readCount = Math.max(Object.values(careers.store.sites).filter(site => site.status === 'ok').length, seedBySite.size)
  const visible = useMemo(() => {
    const term = jobQuery.trim().toLowerCase()
    return rows.filter(row => {
      if (company && siteKeyOf(row.siteUrl) !== company) return false
      if (employment !== 'all' && row.employment !== employment) return false
      if (direction !== 'all' && row.direction !== direction) return false
      if (onlyUnadded && existingJobs.some(job => sameJob(job, row))) return false
      return !term || `${row.company} ${row.role} ${row.url} ${row.email}`.toLowerCase().includes(term)
    })
  }, [company, direction, employment, existingJobs, jobQuery, onlyUnadded, rows])
  const sites = useMemo(() => {
    const term = sourceQuery.trim().toLowerCase()
    return careerSites.filter(site => !term || `${site.company} ${site.url} ${(site.aliases ?? []).join(' ')}`.toLowerCase().includes(term))
  }, [sourceQuery])
  const filtered = !!jobQuery.trim() || !!company || employment !== 'all' || direction !== 'all' || onlyUnadded
  const add = async (row: CareerJobRow) => {
    if (!connected) { onConnect(); return }
    if (slots <= 0) { onError('清单已满 20 个岗位，请先发送或移除后再添加。'); return }
    if (existingJobs.some(job => sameJob(job, row))) return
    setAdding(row.id); careers.setError('')
    try {
      if (row.page) onImported(row.page)
      else {
        const page = await careers.readPage(row.url)
        if ((page.jobs?.length ?? 0) > 1 && !page.role) setPickerPages([page])
        else onImported(page)
      }
    } catch (cause) { careers.setError(cause instanceof Error ? cause.message : '读取岗位失败，请稍后重试。') }
    finally { setAdding(null) }
  }
  const readSiteNow = (site: { company: string; url: string }) => { void careers.readSite(site.company, site.url) }
  return <section className="flex min-h-0 flex-1 flex-col bg-surface" aria-label="职位清单">
    <div className="flex flex-none flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
      <div>
        <p className="m-0 text-body text-text-secondary">共 {rows.length} 个职位 · 已收录 {readCount} / {careerSites.length} 家官网。列表来自预置快照和本机读取缓存。</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" className="h-9 px-3 text-label" onClick={onOpenApplications}>查看投递清单</Button>
        {careers.allProgress ? <Button variant="secondary" className="h-9 px-3 text-label" onClick={careers.cancelReadAll}>停止更新 {careers.allProgress.done}/{careers.allProgress.total}</Button> : <Button variant="secondary" className="h-9 px-3 text-label" disabled={!!careers.busyUrl} onClick={() => void careers.readAll(careerSites)}><RefreshCw size={14} />更新全部</Button>}
        <Button className="h-9 px-3 text-label" onClick={() => setSourceOpen(true)}><RefreshCw size={14} />读取官网</Button>
      </div>
    </div>
    {!connected && <div className="flex flex-none flex-wrap items-center gap-3 border-b border-line bg-warning-soft px-4 py-2 text-body text-warning sm:px-5"><span>读取官网岗位需要连接本机执行器。</span><button type="button" className="underline" onClick={onConnect}>连接本机</button></div>}
    {(careers.error || careers.busyUrl) && <div className="flex flex-none items-center gap-2 border-b border-line px-4 py-2 text-body text-text-secondary sm:px-5" role="status">{careers.busyUrl ? <><RefreshCw size={14} className="animate-spin" />正在读取官网岗位…</> : careers.error}</div>}
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 sm:px-5">
        <label className="relative min-w-[180px] flex-1 sm:max-w-[360px]">
          <input className="mail-input h-9 w-full" aria-label="筛选岗位" placeholder="筛选岗位、公司或链接" value={jobQuery} onChange={event => setJobQuery(event.target.value)} />
        </label>
        <div className="flex items-center border border-line bg-white p-0.5" role="group" aria-label="按招聘类型筛选">
          {([['all', '全部'], ['campus', '校招'], ['social', '社招'], ['unknown', '未标注']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={employment === key} className={`h-7 px-2.5 text-label ${employment === key ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-hover'}`} onClick={() => setEmployment(key)}>{label}</button>)}
        </div>
        <select className="mail-input h-9 w-auto min-w-[120px]" aria-label="按岗位方向筛选" value={direction} onChange={event => setDirection(event.target.value as 'all' | JobDirection)}>
          <option value="all">全部方向</option>
          {Object.entries(DIRECTION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <select className="mail-input h-9 w-auto min-w-[150px]" aria-label="按公司筛选" value={company} onChange={event => setCompany(event.target.value)}>
          <option value="">全部已读公司</option>
          {readCompanies.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
        <button type="button" aria-pressed={onlyUnadded} className={`h-8 px-2.5 text-label ${onlyUnadded ? 'bg-brand text-white' : 'text-text-secondary hover:bg-surface-hover'}`} onClick={() => setOnlyUnadded(value => !value)}>只看未加入</button>
        <span className="ml-auto text-meta text-text-tertiary">{visible.length} 个</span>
      </div>
      {pickerPages.length > 0 && <div className="flex-none border-b border-line bg-surface-soft px-4 py-3 sm:px-5"><p className="mb-2 mt-0 text-body text-text-secondary">这个链接包含多个岗位，选择要加入清单的一个。</p><CareerPagePicker pages={pickerPages} existing={existingJobs} disabled={!connected || slots <= 0} onChoose={page => { onImported(page); setPickerPages([]) }} /></div>}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-[minmax(0,1fr)_150px_130px_110px_110px] items-center gap-2 border-b border-line bg-surface-soft px-4 py-2 text-meta text-text-tertiary max-[760px]:grid-cols-[minmax(0,1fr)_100px_110px]">
          <span>公司 / 岗位</span><span className="max-[760px]:hidden">邮箱</span><span className="max-[760px]:hidden">来源</span><span>读取时间</span><span>操作</span>
        </div>
        {!careers.hydrated ? <p className="px-4 py-10 text-body text-text-tertiary">正在读取岗位缓存…</p> : visible.length === 0 ? <div className="px-4 py-12 text-center">
          <p className="m-0 text-body font-medium">{rows.length === 0 ? readCount > 0 ? '已读取的官网里没有岗位' : '还没有读取岗位' : '没有符合筛选的岗位'}</p>
          <p className="mx-auto mt-2 max-w-md text-body leading-relaxed text-text-tertiary">{rows.length === 0 ? readCount > 0 ? '可以重新读取这些官网，或换一批公司。' : '点“更新全部”，逐家读取官网；读完后这里就是完整职位清单。' : '换一个关键词，或清除筛选条件。'}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">{filtered && <Button variant="secondary" onClick={() => { setJobQuery(''); setCompany(''); setEmployment('all'); setDirection('all'); setOnlyUnadded(false) }}>清除筛选</Button>}{rows.length === 0 && <><Button onClick={() => void careers.readAll(careerSites)}>更新全部官网</Button><Button variant="secondary" onClick={() => setSourceOpen(true)}>选公司读取</Button></>}</div>
        </div> : <div className="divide-y divide-line">
          {visible.map(row => {
            const added = existingJobs.some(job => sameJob(job, row))
            return <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_150px_130px_110px_110px] items-center gap-2 px-4 py-3 max-[760px]:grid-cols-[minmax(0,1fr)_100px_110px]">
              <div className="min-w-0">
                <a href={row.url} target="_blank" rel="noopener noreferrer" className="block truncate text-label font-semibold text-text-primary hover:text-accent">{row.role}</a>
                <span className="mt-0.5 block truncate text-meta text-text-tertiary">{row.company} · {EMPLOYMENT_LABELS[row.employment]} · {DIRECTION_LABELS[row.direction]}{row.kind === 'link' ? ' · 岗位链接' : ''}</span>
              </div>
              <span className="truncate text-meta text-text-secondary max-[760px]:hidden">{row.email || '—'}</span>
              <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="truncate text-meta text-text-tertiary underline max-[760px]:hidden">{hostname(row.sourceUrl)}</a>
              <span className="text-meta text-text-tertiary">{savedDate(row.fetchedAt)}</span>
              <div className="flex items-center gap-1">
                <a href={row.url} target="_blank" rel="noopener noreferrer" className="grid size-8 place-items-center text-text-tertiary hover:text-text-primary" aria-label={`打开 ${row.role}`}><ExternalLink size={14} /></a>
                <Button variant="secondary" className="h-7 px-2 text-label" aria-label={added ? `${row.role} 已加入` : `加入 ${row.role}`} disabled={!connected || slots <= 0 || added || adding === row.id} loading={adding === row.id} onClick={() => void add(row)}>{added ? '已加入' : '加入清单'}</Button>
              </div>
            </div>
          })}
        </div>}
      </div>
    </div>

    {sourceOpen && <Dialog open onClose={() => setSourceOpen(false)} label="读取招聘官网" panelClassName="w-[min(720px,calc(100%-24px))] max-h-[calc(100dvh-32px)] overflow-y-auto border border-line bg-white">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white px-5 py-3">
        <div><h2 className="m-0 text-section font-semibold">读取招聘官网</h2><p className="mb-0 mt-1 text-meta text-text-tertiary">读取只访问公开页面，不会投递或填写表单。结果会缓存到本地。</p></div>
        <Button variant="secondary" className="h-8 px-3 text-label" onClick={() => setSourceOpen(false)}>关闭</Button>
      </header>
      <div className="border-b border-line px-5 py-3">
        <label className="relative block">
          <input className="mail-input h-9 w-full" aria-label="筛选招聘官网" placeholder="筛选公司、别名或域名" value={sourceQuery} onChange={event => setSourceQuery(event.target.value)} />
        </label>
      </div>
      <div className="divide-y divide-line">
        {sites.map(site => {
          const key = siteKeyOf(site.url)
          const snapshot = careers.store.sites[key]
          const count = rowsBySite.get(key) ?? 0
          return <div key={key} className="flex items-center gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <a href={site.url} target="_blank" rel="noopener noreferrer" className="block truncate text-label font-medium hover:text-accent">{site.company}</a>
              <span className={`mt-0.5 block truncate text-meta ${snapshot?.status === 'failed' ? 'text-danger' : 'text-text-tertiary'}`}>{snapshot ? snapshot.status === 'failed' ? `读取失败 · ${snapshot.error ?? '可重试'}` : `${snapshot.pagesRead} 页 · ${count} 个岗位 · ${savedDate(snapshot.fetchedAt)}` : seedBySite.get(key) ? `预置 ${seedBySite.get(key)} 个岗位` : '未读取'}</span>
            </div>
            <Button variant="secondary" className="h-8 px-3 text-label" disabled={!!careers.busyUrl} loading={careers.busyUrl === site.url} onClick={() => readSiteNow(site)}>{careers.busyUrl === site.url ? '读取中' : snapshot ? '重新读取' : '读取'}</Button>
          </div>
        })}
        {!sites.length && <p className="px-5 py-8 text-center text-body text-text-tertiary">没有匹配的官网。</p>}
      </div>
    </Dialog>}
  </section>
}
