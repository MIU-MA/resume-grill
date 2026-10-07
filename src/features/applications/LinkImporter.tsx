'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { sourceUrlSchema, type CareerDiscovery, type CareerPage } from '@/domain/mail-schema'
import { CareerFinder } from './CareerFinder'
import { PastedCareerForm } from './PastedCareerForm'
import { careerUrlKey, planCareerImports, settleCareerFailure, type CareerFailure } from './pasted-career'

export function LinkImporter({ existingUrls, slots, connected, onConnect, read, discover, onImported, onBusy }: {
  existingUrls: string[]; slots: number; connected: boolean; onConnect: () => void
  read: (url: string) => Promise<CareerPage>; onImported: (page: CareerPage) => void
  discover: (url: string) => Promise<CareerDiscovery>
  onBusy: (value: boolean) => void
}) {
  const [input, setInput] = useState('')
  const [finding, setFinding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [failures, setFailures] = useState<CareerFailure[]>([])
  const [pasteUrl, setPasteUrl] = useState<string | null>(null)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const removeInput = (url: string) => setInput(current => current.split(/\s+/).filter(value => value && (!sourceUrlSchema.safeParse(value).success || careerUrlKey(value) !== careerUrlKey(url))).join('\n'))
  const complete = (url: string, page: CareerPage) => {
    onImported(page)
    setFailures(current => settleCareerFailure(current, url))
    removeInput(url)
    setPasteUrl(current => current && careerUrlKey(current) === careerUrlKey(url) ? null : current)
  }
  const openPaste = (chosen?: string) => {
    try {
      const values = chosen ? [chosen] : input.split(/\s+/).filter(Boolean)
      if (!values.length) { setMessage('先粘贴招聘详情链接，再补充正文。'); return }
      const urls = planCareerImports(values, existingUrls, slots)
      if (urls.length === 1) { setPasteUrl(urls[0]); setMessage(''); return }
      setFailures(current => urls.reduce((items, url) => items.some(item => careerUrlKey(item.url) === careerUrlKey(url)) ? items : [...items, { url, message: '待补充招聘正文。' }], current))
      setMessage('选择一个链接，粘贴这个职位的正文。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '请检查链接。') }
  }
  const importLinks = async (chosen?: string[]) => {
    if (!connected) { onConnect(); return }
    const values = [...new Set(chosen ?? input.split(/\s+/).filter(Boolean))]
    if (!values.length) return
    let urls: string[]
    try { urls = planCareerImports(values, existingUrls, slots) }
    catch (error) { setMessage(error instanceof Error ? error.message : '请检查链接。'); return }
    setBusy(true); onBusy(true)
    let failed = 0
    const seen = new Set(existingUrls.filter(value => sourceUrlSchema.safeParse(value).success).map(careerUrlKey))
    try {
      for (let i = 0; i < urls.length; i++) {
        if (!active.current) break
        setMessage(`正在读取 ${i + 1} / ${urls.length}`)
        try {
          const page = await read(urls[i])
          if (active.current) {
            if (!seen.has(careerUrlKey(page.url))) { complete(urls[i], page); seen.add(careerUrlKey(page.url)) }
            else { removeInput(urls[i]); setFailures(current => settleCareerFailure(current, urls[i])) }
          }
        } catch (error) {
          failed++
          if (active.current) setFailures(current => settleCareerFailure(current, urls[i], error instanceof Error ? error.message : '读取失败'))
        }
      }
      if (active.current) setMessage(`已处理 ${urls.length - failed} 个链接${failed ? `，${failed} 个未能读取，可重试或粘贴正文。` : '，请核对清单中的内容。'}`)
    } finally { setBusy(false); onBusy(false) }
  }
  return <section className="flex-none border-b border-line bg-surface px-4 py-3 sm:px-5" aria-label="导入招聘链接">
    <CareerFinder connected={connected} disabled={busy} onConnect={onConnect} discover={discover} onBusy={value => { setFinding(value); onBusy(value) }} onChoose={urls => { setInput(urls.join('\n')); void importLinks(urls) }} />
    <details className="mt-3 border-t border-line pt-3">
      <summary className="w-fit cursor-pointer text-[12px] text-text-secondary">已有具体岗位链接 · 粘贴到清单</summary>
    <div className="mt-3 flex flex-wrap items-start gap-2">
      <textarea aria-label="招聘链接，每行一个" className="mail-input min-h-9 flex-1 basis-full resize-y text-[12px] sm:basis-0" rows={Math.min(3, input.split('\n').length)} placeholder="粘贴招聘详情链接，多个链接每行一个" disabled={busy || finding} value={input} onChange={e => setInput(e.target.value)} />
      <Button loading={busy} disabled={finding || !input.trim() || slots <= 0} onClick={() => void importLinks()}>{connected ? '整理到清单' : '连接后整理'}</Button>
      <Button variant="ghost" className="px-2 text-[12px]" disabled={busy || finding || slots <= 0} onClick={() => openPaste()}>粘贴正文</Button>
    </div>
    </details>
    {message && <p role="status" className="mb-0 mt-2 text-[12px] text-text-secondary">{message}</p>}
    {failures.length > 0 && <div className="mt-2 space-y-2 text-[12px]">{failures.map(failure => <div key={failure.url} className="border-t border-line pt-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><a href={failure.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 break-all text-text-secondary underline">{failure.url}</a><button className="shrink-0 text-text-secondary underline disabled:opacity-40" disabled={busy || finding} onClick={() => void importLinks([failure.url])}>{connected ? '重试读取' : '连接后重试'}</button><button className="shrink-0 text-accent underline disabled:opacity-40" disabled={busy || finding || slots <= 0} onClick={() => openPaste(failure.url)}>粘贴正文补充</button></div>
      <p className="mb-0 mt-1 break-words text-text-tertiary">{failure.message}</p>
    </div>)}</div>}
    {pasteUrl && <PastedCareerForm key={pasteUrl} url={pasteUrl} disabled={busy || finding} onCancel={() => setPasteUrl(null)} onImported={page => {
      planCareerImports([page.url], existingUrls, slots)
      complete(pasteUrl, page)
      setMessage('已从正文整理到清单，请核对识别结果。')
    }} />}
  </section>
}
