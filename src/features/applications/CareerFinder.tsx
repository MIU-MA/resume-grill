'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { sourceUrlSchema, type CareerDiscovery, type CareerPage } from '@/domain/mail-schema'
import { careerSites } from '@/data/career-sites'
import { CareerPagePicker } from './CareerPagePicker'

const labels = { entry: '招聘入口', job: '岗位详情', apply: '在线申请' }

export function CareerFinder({ connected, disabled, onConnect, discover, onChoose, onPage, existingJobs, slots, onBusy }: {
  connected: boolean; disabled: boolean; onConnect: () => void
  discover: (url: string) => Promise<CareerDiscovery>
  onChoose: (urls: string[]) => void; onBusy: (value: boolean) => void
  onPage: (page: CareerPage) => void; existingJobs: Array<{ sourceUrl: string; role: string }>; slots: number
}) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CareerDiscovery | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const pending = useRef<string | null>(null)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const search = async (value = url) => {
    if (busy || disabled) return
    const target = value.trim()
    setOpen(true); setUrl(target)
    if (!sourceUrlSchema.safeParse(target).success) { setError('请输入完整的 HTTPS 官网或招聘页地址。'); return }
    if (!connected) { pending.current = target; onConnect(); return }
    pending.current = null
    setBusy(true); onBusy(true); setError(''); setResult(null); setSelected([])
    setFilter('')
    try { const next = await discover(target); if (active.current) setResult(next) }
    catch (err) { if (active.current) setError(err instanceof Error ? err.message : '查找失败，请稍后重试。') }
    finally { if (active.current) { setBusy(false); onBusy(false) } }
  }
  const resumeSearch = useEffectEvent((value: string) => { void search(value) })
  useEffect(() => {
    if (connected && !disabled && !busy && pending.current) {
      const value = pending.current; pending.current = null; resumeSearch(value)
    }
  }, [connected, disabled, busy])
  const links = result?.links.filter(link => `${link.label} ${link.url}`.toLowerCase().includes(filter.toLowerCase())) ?? []
  return <div>
    <p className="mb-2 mt-0 text-[12px] text-text-secondary">打开官网挑职位，或点击「读取」从网页中选择。</p>
    <div className="career-directory" aria-label="招聘官网">
      {careerSites.map(site => <div className="career-site" key={site.url}><a href={site.url} target="_blank" rel="noopener noreferrer" title={site.url}>
        <span className="career-monogram" aria-hidden="true">{site.company.slice(0, 1)}</span><span className="career-company">{site.company}</span><span className="career-arrow" aria-hidden="true">↗</span>
      </a><button type="button" className="career-read" aria-label={`读取${site.company}招聘岗位`} disabled={busy || disabled} onClick={() => void search(site.url)}>读取</button></div>)}
    </div>
    <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="mt-3 text-[12px]">
      <summary className="w-fit cursor-pointer text-text-secondary">查找其他官网或岗位链接</summary>
    <div className="mt-3 flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 text-[12px] text-text-secondary">公司官网或招聘页<input className="mail-input mt-1 w-full" type="url" placeholder="https://公司官网" value={url} disabled={busy || disabled} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && url.trim() && !busy && !disabled) void search() }} /></label>
      <Button loading={busy} disabled={disabled || !url.trim()} onClick={() => void search()}>{connected ? '查找链接' : '连接后查找'}</Button>
    </div>
    {busy && <p role="status" className="my-2 text-[12px] text-text-secondary">正在查找招聘页面…</p>}
    {error && <p role="alert" className="my-2 text-[12px] text-danger">{error}</p>}
    {result && <>
      <div className="my-2 flex flex-wrap items-center gap-3 text-[12px]"><span>已读取 {result.pagesRead} 页</span><input aria-label="筛选岗位链接" className="mail-input min-w-0 flex-1" placeholder="筛选岗位，如前端" value={filter} onChange={e => setFilter(e.target.value)} />{!!selected.length && <Button disabled={disabled || slots < selected.length} onClick={() => onChoose(selected)}>加入所选链接（{selected.length}）</Button>}</div>
      {!!result.pages?.length && <CareerPagePicker pages={result.pages} existing={existingJobs} disabled={disabled || slots <= 0} filter={filter} onChoose={onPage} />}
      {!!result.links.length && <div className="max-h-[240px] overflow-auto border border-line divide-y divide-line" aria-label="官网招聘链接">
        {links.map(link => <div key={link.url} className="flex items-start gap-2 px-3 py-2 text-[12px]">
          {link.kind === 'job' ? <input className="mt-1" type="checkbox" aria-label={`选择 ${link.label}`} disabled={disabled} checked={selected.includes(link.url)} onChange={e => setSelected(values => e.target.checked ? [...values, link.url] : values.filter(value => value !== link.url))} /> : <span className="mt-1 w-[13px] shrink-0" />}
          <div className="min-w-0 flex-1"><a href={link.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">{link.label}</a><div className="break-all text-text-tertiary">{link.url}</div><div className="text-text-tertiary">来源：<a className="underline" href={link.sourceUrl} target="_blank" rel="noopener noreferrer">{new URL(link.sourceUrl).hostname}</a></div></div>
          <span className="workbench-status shrink-0" data-tone={link.kind === 'entry' ? 'neutral' : 'info'}>{labels[link.kind]}</span>
        </div>)}
        {!links.length && <p className="px-3 text-[12px] text-text-secondary">{result.links.length ? '没有匹配的链接。' : '暂无结果。'}</p>}
      </div>}
      <p className="my-2 text-[12px] text-text-secondary">加入清单时带入公司、岗位和招聘邮箱；同页多个职位按所选岗位整理。</p>
      {result.notes.map(note => <p key={note} className="my-1 break-all text-[12px] text-text-tertiary">{note}</p>)}
    </>}
    </details>
  </div>
}
