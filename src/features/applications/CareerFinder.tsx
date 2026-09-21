'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { sourceUrlSchema, type CareerDiscovery } from '@/domain/mail-schema'
import { careerSites } from '@/data/career-sites'

const labels = { entry: '招聘入口', job: '岗位详情', apply: '在线申请' }

export function CareerFinder({ connected, disabled, onConnect, discover, onChoose, onBusy }: {
  connected: boolean; disabled: boolean; onConnect: () => void
  discover: (url: string) => Promise<CareerDiscovery>
  onChoose: (urls: string[]) => void; onBusy: (value: boolean) => void
}) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<CareerDiscovery | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const search = async () => {
    if (!connected) { onConnect(); return }
    if (!sourceUrlSchema.safeParse(url.trim()).success) { setError('请输入完整的 HTTPS 官网或招聘页地址。'); return }
    setBusy(true); onBusy(true); setError(''); setResult(null); setSelected([])
    try { const next = await discover(url.trim()); if (active.current) setResult(next) }
    catch (err) { if (active.current) setError(err instanceof Error ? err.message : '查找失败，请稍后重试。') }
    finally { if (active.current) { setBusy(false); onBusy(false) } }
  }
  const links = result?.links.filter(link => `${link.label} ${link.url}`.toLowerCase().includes(filter.toLowerCase())) ?? []
  return <div className="mt-2">
    <p className="mb-2 mt-0 text-[12px] text-text-secondary">招聘官网 · 打开后选择职位</p>
    <div className="mb-3 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 xl:grid-cols-5" aria-label="招聘官网">
      {careerSites.map(site => <a key={site.url} href={site.url} target="_blank" rel="noopener noreferrer" className="min-w-0 bg-white px-3 py-2 hover:bg-surface-soft">
        <div className="flex items-center justify-between gap-2 text-[13px]"><span>{site.company}</span><span className="text-text-tertiary" aria-hidden="true">↗</span></div>
        <div className="mt-1 truncate text-[11px] text-text-tertiary">{new URL(site.url).hostname}</div>
      </a>)}
    </div>
    <div className="flex flex-wrap items-end gap-2">
      <label className="min-w-0 flex-1 text-[12px] text-text-secondary">公司官网或招聘页<input className="mail-input mt-1 w-full" type="url" placeholder="https://公司官网" value={url} disabled={busy || disabled} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && url.trim() && !busy && !disabled) void search() }} /></label>
      <Button loading={busy} disabled={disabled || !url.trim()} onClick={() => void search()}>{connected ? '查找链接' : '连接后查找'}</Button>
    </div>
    {busy && <p role="status" className="my-2 text-[12px] text-text-secondary">正在沿官网招聘入口查找，最多读取 6 个页面…</p>}
    {error && <p role="alert" className="my-2 text-[12px] text-danger">{error}</p>}
    {result && <>
      <div className="my-2 flex flex-wrap items-center gap-3 text-[12px]"><span>读取 {result.pagesRead} 页 · 找到 {result.links.length} 个链接</span><input aria-label="筛选岗位链接" className="mail-input min-w-0 flex-1" placeholder="筛选岗位或关键词" value={filter} onChange={e => setFilter(e.target.value)} /><Button disabled={!selected.length || disabled} onClick={() => onChoose(selected)}>使用所选岗位（{selected.length}）</Button></div>
      <div className="max-h-[240px] overflow-auto border border-line divide-y divide-line" aria-label="官网招聘链接">
        {links.map(link => <div key={link.url} className="flex items-start gap-2 px-3 py-2 text-[12px]">
          {link.kind === 'job' ? <input className="mt-1" type="checkbox" aria-label={`选择 ${link.label}`} disabled={disabled} checked={selected.includes(link.url)} onChange={e => setSelected(values => e.target.checked ? [...values, link.url] : values.filter(value => value !== link.url))} /> : <span className="mt-1 w-[13px] shrink-0" />}
          <div className="min-w-0 flex-1"><a href={link.url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">{link.label}</a><div className="break-all text-text-tertiary">{link.url}</div><div className="text-text-tertiary">来源：<a className="underline" href={link.sourceUrl} target="_blank" rel="noopener noreferrer">{new URL(link.sourceUrl).hostname}</a></div></div>
          <span className="shrink-0 text-text-secondary">{labels[link.kind]}</span>
        </div>)}
        {!links.length && <p className="px-3 text-[12px] text-text-secondary">{result.links.length ? '没有匹配的链接。' : '暂无结果。'}</p>}
      </div>
      <p className="my-2 text-[12px] text-text-secondary">岗位详情可整理为邮件草稿；在线申请请打开原站填写。无招聘邮箱的岗位需要补充地址才能发送。</p>
      {result.notes.map(note => <p key={note} className="my-1 break-all text-[12px] text-text-tertiary">{note}</p>)}
    </>}
  </div>
}
