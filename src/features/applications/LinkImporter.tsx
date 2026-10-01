'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { sourceUrlSchema, type CareerDiscovery, type CareerPage } from '@/domain/mail-schema'
import { CareerFinder } from './CareerFinder'


export function LinkImporter({ existingUrls, slots, connected, onConnect, read, discover, onImported, onBusy }: {
  existingUrls: string[]; slots: number; connected: boolean; onConnect: () => void
  read: (url: string) => Promise<CareerPage>; onImported: (page: CareerPage) => void
  discover: (url: string) => Promise<CareerDiscovery>
  onBusy: (value: boolean) => void
}) {
  const [input, setInput] = useState('')
  const [finderOpen, setFinderOpen] = useState(false)
  const [finding, setFinding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failures, setFailures] = useState<string[]>([])
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const normalize = (url: string) => { const parsed = new URL(url); parsed.hash = ''; return parsed.href }
  const importLinks = async (chosen?: string[]) => {
    if (!connected) { onConnect(); return }
    const values = [...new Set(chosen ?? input.split(/\s+/).filter(Boolean))]
    if (!values.length) return
    if (values.some(value => !sourceUrlSchema.safeParse(value).success)) { setMessage('请每行粘贴一个完整的 HTTPS 招聘详情链接。'); return }
    const seen = new Set(existingUrls.filter(value => sourceUrlSchema.safeParse(value).success).map(normalize))
    const urls = values.filter(value => { const key = normalize(value); if (seen.has(key)) return false; seen.add(key); return true })
    if (!urls.length) { setMessage('这些链接已经在清单中，无需重复导入。'); return }
    if (urls.length > slots) { setMessage(`这批还能添加 ${slots} 个岗位，请减少链接数量。`); return }
    setBusy(true); onBusy(true); setFailures([])
    const failed: string[] = []; const errors: string[] = []
    try {
      for (let i = 0; i < urls.length; i++) {
        if (!active.current) break
        setMessage(`正在读取 ${i + 1} / ${urls.length}`)
        try { const page = await read(urls[i]); if (active.current) onImported(page) }
        catch (error) { failed.push(urls[i]); errors.push(`${urls[i]}：${error instanceof Error ? error.message : '读取失败'}`) }
      }
      setInput(failed.join('\n')); setFailures(errors)
      setMessage(`已整理 ${urls.length - failed.length} 个岗位${failed.length ? `，${failed.length} 个链接未能读取，可修改后重试。` : '，请核对右侧邮件。'}`)
    } finally { setBusy(false); onBusy(false) }
  }
  return <section className="flex-none border-b border-line bg-surface px-4 py-3 sm:px-5" aria-label="导入招聘链接">
    <div className="flex flex-wrap items-start gap-2">
      <textarea aria-label="招聘链接，每行一个" className="mail-input min-h-9 flex-1 basis-full resize-y text-[12px] sm:basis-0" rows={Math.min(3, input.split('\n').length)} placeholder="粘贴招聘详情链接，多个链接每行一个" disabled={busy || finding} value={input} onChange={e => setInput(e.target.value)} />
      <Button loading={busy} disabled={finding || !input.trim() || slots <= 0} onClick={() => void importLinks()}>{connected ? '整理到清单' : '连接后整理'}</Button>
      <Button variant="ghost" className="px-2 text-[12px]" disabled={busy || finding} aria-expanded={finderOpen} onClick={() => setFinderOpen(value => !value)}>{finderOpen ? '收起官网' : '找招聘官网'}</Button>
    </div>
    <div hidden={!finderOpen}><CareerFinder connected={connected} disabled={busy} onConnect={onConnect} discover={discover} onBusy={value => { setFinding(value); onBusy(value) }} onChoose={urls => { setInput(urls.join('\n')); setFinderOpen(false); void importLinks(urls) }} /></div>
    {message && <p role="status" className="mb-0 mt-2 text-[12px] text-text-secondary">{message}</p>}
    {failures.length > 0 && <details className="mt-2 text-[12px] text-danger"><summary>查看未成功的链接</summary>{failures.map(value => <p className="break-all" key={value}>{value}</p>)}</details>}
  </section>
}
