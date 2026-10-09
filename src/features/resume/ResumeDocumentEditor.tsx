'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, FileText, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PdfPages } from './PdfPages'
import { changedRevisionRanges, editableRevisionRange, findRevisionTargets, mapRevisionTarget } from './resume-revision'
import type { ResumePdfArtifact, PdfTextBlock } from './lib/resume-pdf'
import { downloadResumeFile } from './lib/resume-revision'

type Selection = { start: number; end: number; snapshot: string; original: string }
type Props = {
  baseText: string
  text: string
  artifact: ResumePdfArtifact | null
  previous: ResumePdfArtifact | null
  loading: boolean
  error: string | null
  disabled: boolean
  request?: { evidence: string; time: number } | null
  onChange: (text: string) => void
  onRetry: () => void
  onLoadOriginal?: () => Promise<File | undefined>
}

export function ResumeDocumentEditor({ baseText, text, artifact, previous, loading, error, disabled, request, onChange, onRetry, onLoadOriginal }: Props) {
  const [view, setView] = useState<'draft' | 'original'>('draft')
  const [original, setOriginal] = useState<File | null>(null)
  const [originalError, setOriginalError] = useState('')
  const [originalLoading, setOriginalLoading] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [matches, setMatches] = useState<ReturnType<typeof findRevisionTargets>>([])
  const [notice, setNotice] = useState('')
  const editor = useRef<HTMLTextAreaElement>(null)
  const latest = useRef(text)
  latest.current = text
  const active = selection?.snapshot === text ? selection : null
  const selectedStart = active?.start
  const shown = artifact ?? previous
  const changedRanges = useMemo(() => changedRevisionRanges(baseText, text), [baseText, text])
  const originalAction = useRef(false)

  useEffect(() => {
    if (!request) return
    const current = latest.current
    const targets = findRevisionTargets(baseText, request.evidence).flatMap(target => {
      const mapped = mapRevisionTarget(baseText, current, target)
      const range = mapped ? editableRevisionRange(current, mapped) : null
      return range ? [{ ...range, text: current.slice(range.start, range.end), line: target.line }] : []
    })
    setView('draft')
    setMatches(targets.length > 1 ? targets : [])
    setNotice(targets.length ? '' : '没找到对应段落，可以直接点击预览中的文字修改。')
    setSelection(targets.length === 1 ? { start: targets[0].start, end: targets[0].end, snapshot: current, original: targets[0].text } : null)
  }, [request, baseText])
  useEffect(() => { if (selectedStart !== undefined) editor.current?.focus({ preventScroll: true }) }, [selectedStart])

  const select = (block: Pick<PdfTextBlock, 'start' | 'end'>) => {
    const range = editableRevisionRange(text, block)
    setSelection({ ...range, snapshot: text, original: text.slice(range.start, range.end) })
    setMatches([])
    setNotice('')
  }
  const change = (replacement: string) => {
    if (!active || disabled) return
    const next = text.slice(0, active.start) + replacement + text.slice(active.end)
    setSelection({ ...active, end: active.start + replacement.length, snapshot: next })
    onChange(next)
  }
  const showOriginal = async () => {
    setView('original')
    if (original || !onLoadOriginal || originalAction.current) return
    originalAction.current = true
    setOriginalLoading(true)
    setOriginalError('')
    try {
      const file = await onLoadOriginal()
      if (!file) throw new Error('这份简历没有保存原文件。')
      setOriginal(file)
    } catch (cause) { setOriginalError(cause instanceof Error ? cause.message : '原文件读取失败。') }
    finally { originalAction.current = false; setOriginalLoading(false) }
  }

  return <section className="resume-document-editor flex h-full min-h-0 min-w-0 flex-col border-l border-line bg-surface-soft" aria-label="简历 PDF 编辑与预览">
    <header className="flex min-h-14 flex-none flex-wrap items-center gap-3 border-b border-line bg-surface px-4 py-3">
      <strong className="mr-auto text-[13px] font-medium">简历预览</strong>
      <button type="button" aria-pressed={view === 'draft'} onClick={() => setView('draft')} className={`text-[12px] ${view === 'draft' ? 'font-semibold text-text-primary' : 'text-text-tertiary'}`}>新稿</button>
      {onLoadOriginal && <button type="button" aria-pressed={view === 'original'} onClick={() => { void showOriginal() }} className={`text-[12px] ${view === 'original' ? 'font-semibold text-text-primary' : 'text-text-tertiary'}`}>原文件</button>}
      {view === 'draft' && <span role="status" className="flex items-center gap-1 text-[11px] text-text-tertiary">{loading ? <><Loader2 size={12} className="animate-spin" />更新中</> : artifact ? `${artifact.pageCount} 页` : ''}</span>}
    </header>
    {view === 'draft' && <>
      <p className="m-0 flex-none border-b border-line px-4 py-2 text-[11px] leading-relaxed text-text-secondary">点击段落就能改。新稿按单列排版，原文件仍保留。</p>
      {notice && <p role="status" className="m-0 px-4 py-2 text-[12px] text-text-secondary">{notice}</p>}
      {matches.length > 0 && <div className="max-h-40 flex-none overflow-y-auto border-b border-line p-3 text-[12px]"><p className="mt-0">有多处相同原文，请选择：</p>{matches.map(target => <button key={target.start} type="button" disabled={disabled} className="mb-2 block w-full border border-line bg-surface p-2 text-left" onClick={() => select(target)}>第 {target.line} 行 · {target.text}</button>)}</div>}
      {active && <div className="flex-none border-b border-line bg-surface p-3">
        <div className="mb-2 flex items-center justify-between"><span className="text-[12px] font-medium">修改这段</span><Button variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => setSelection(null)}><Check size={12} />完成</Button></div>
        <textarea ref={editor} aria-label="修改选中段落" disabled={disabled} value={text.slice(active.start, active.end)} onChange={event => change(event.target.value)} className="block max-h-52 min-h-24 w-full resize-y border border-line-strong bg-white p-3 text-[13px] leading-relaxed focus:border-brand focus:outline-brand" />
        <button type="button" disabled={disabled || text.slice(active.start, active.end) === active.original} className="mt-2 flex items-center gap-1 text-[11px] text-text-secondary disabled:opacity-40" onClick={() => change(active.original)}><RotateCcw size={12} />撤销本次修改</button>
      </div>}
    </>}
    <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
      {view === 'draft' ? <>
        {error && <p role="alert" className="border border-danger bg-danger-soft p-3 text-[12px] text-danger">{error}<button type="button" className="ml-2 underline" onClick={onRetry}>重试预览</button></p>}
        {shown ? <PdfPages file={shown.file} artifact={shown} disabled={disabled || !artifact} selectedStart={active?.start} changedRanges={artifact ? changedRanges : undefined} onSelect={select} /> : !error && <p role="status" className="text-[12px] text-text-tertiary">正在生成 PDF 预览…</p>}
      </> : original ? original.name.toLowerCase().endsWith('.pdf') ? <PdfPages file={original} /> : <div className="border border-line bg-surface p-4 text-[12px] leading-relaxed"><FileText size={18} /><p>{original.name}</p><p>原文件是 Word 或文本文件。请下载后打开核对；新版 PDF 可在「新稿」中查看。</p><Button variant="secondary" className="text-[12px]" onClick={() => downloadResumeFile(original)}>下载原文件</Button></div>
        : <p role={originalError ? 'alert' : 'status'} className={`text-[12px] ${originalError ? 'text-danger' : 'text-text-secondary'}`}>{originalLoading ? '正在读取原文件…' : originalError || '暂无原文件。'}{originalError && <button className="ml-2 underline" onClick={() => { void showOriginal() }}>重试</button>}</p>}
    </div>
  </section>
}
