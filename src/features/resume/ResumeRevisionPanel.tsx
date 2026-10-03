'use client'

import { useMemo, useState } from 'react'
import { Check, Download, Eye, Loader2, Pencil, RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { resumeDocumentParagraphs } from '@/lib/resume-docx'
import { findRevisionTargets, mapRevisionTarget, replaceRevisionTarget, type RevisionTarget } from './resume-revision'

export function ResumeIssueEditor({ baseText, text, evidence, disabled, onChange, onFullText }: {
  baseText: string; text: string; evidence: string; disabled: boolean
  onChange: (text: string) => void; onFullText: () => void
}) {
  const targets = useMemo(() => findRevisionTargets(baseText, evidence), [baseText, evidence])
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<RevisionTarget | null>(null)
  const [activeRange, setActiveRange] = useState<{ targetStart: number; snapshot: string; start: number; end: number } | null>(null)
  const target = selected ?? (targets.length === 1 ? targets[0] : null)
  // Keep the exact range of this edit as the user types. Once adjacent paragraphs
  // both change, a diff against the original alone can only locate their combined block.
  const range = target && activeRange?.targetStart === target.start && activeRange.snapshot === text
    ? activeRange
    : target ? mapRevisionTarget(baseText, text, target) : null
  const current = range ? text.slice(range.start, range.end) : ''
  const lineEnding = target?.text.endsWith('\r\n') ? '\r\n' : target?.text.endsWith('\n') ? '\n' : ''
  const withoutEnding = (value: string) => value.replace(/\r?\n$/, '')
  const replace = (replacement: string) => {
    if (!range || !target) return
    const next = replaceRevisionTarget(text, range, replacement)
    setActiveRange({ targetStart: target.start, snapshot: next, start: range.start, end: range.start + replacement.length })
    onChange(next)
  }

  if (!open) return <div className="mt-4"><Button variant="secondary" className="h-8 px-3 text-[12px]" disabled={disabled} onClick={() => targets.length ? setOpen(true) : onFullText()}><Pencil size={13} />{targets.length ? '修改这段' : '修改全文'}</Button>{!targets.length && <span className="ml-3 text-[12px] text-text-tertiary">未定位到完整原文，可在全文中补充。</span>}</div>

  return <div className="mt-5 border border-line-strong bg-surface-soft p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <strong className="text-[13px] font-medium">修改这段</strong>
      <Button variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => setOpen(false)}><Check size={13} />收起</Button>
    </div>
    {targets.length > 1 && !selected ? <div className="space-y-2">
      <p className="m-0 text-[12px] text-text-secondary">原文有多处相同内容，请选择要修改的位置。</p>
      {targets.map((item) => <button type="button" key={item.start} disabled={disabled} onClick={() => setSelected(item)} className="block w-full border border-line bg-surface px-3 py-2 text-left hover:border-brand"><span className="block text-[11px] text-text-tertiary">第 {item.line} 行</span><span className="mt-1 block whitespace-pre-wrap break-words text-[13px] leading-relaxed">{item.text}</span></button>)}
    </div> : range && target ? <>
      <div className="grid gap-4 xl:grid-cols-2">
        <div><span className="mb-2 block text-[12px] text-text-tertiary">修改前 · 第 {target.line} 行</span><p className="m-0 whitespace-pre-wrap break-words text-[13px] leading-[1.8] text-text-secondary">{withoutEnding(target.text)}</p></div>
        <label className="block text-[12px] text-text-secondary">修改后<textarea aria-label="修改后的段落" autoFocus disabled={disabled} value={withoutEnding(current)} onChange={(event) => replace(event.target.value + lineEnding)} className="mt-2 block min-h-32 w-full resize-y border border-line-strong bg-surface p-3 text-[13px] leading-[1.8] text-text-primary focus:border-brand focus:outline-brand" /></label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="ghost" className="h-7 px-2 text-[12px]" disabled={disabled || current === target.text} onClick={() => replace(target.text)}><RotateCcw size={13} />撤销这处修改</Button>
        {targets.length > 1 && <button type="button" disabled={disabled} onClick={() => setSelected(null)} className="text-[12px] text-text-secondary underline underline-offset-4">选择其他位置</button>}
        <span className="ml-auto text-[11px] text-text-tertiary">只补充你实际做过的内容</span>
      </div>
    </> : <div className="flex flex-wrap items-center gap-3"><p className="m-0 text-[12px] text-text-secondary">这段内容已与相邻段落一起修改，请在全文中继续编辑。</p><Button variant="secondary" className="h-8 text-[12px]" disabled={disabled} onClick={onFullText}>查看全文</Button></div>}
  </div>
}

export function ResumeRevisionToolbar({ text, conflict, saving, draftStatus, error, onPreview, onSave, onDiscard }: {
  text: string; conflict: boolean; saving: boolean; draftStatus: 'saving' | 'saved' | 'error'
  error: string | null; onPreview: () => void; onSave: () => void; onDiscard: () => void
}) {
  return <div className="flex-none border-b border-line bg-brand-soft px-4 py-2.5 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[12px] text-text-secondary" role="status">{conflict ? '暂存稿对应的原文已变化，请查看暂存内容后放弃此稿。' : draftStatus === 'error' ? '修改未能暂存，请保持页面打开后重试保存。' : draftStatus === 'saving' ? '正在暂存修改…' : '修改已暂存；检查结果基于修改前内容。'}</span>
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" className="h-8 px-2.5 text-[12px]" disabled={saving} onClick={onPreview}><Eye size={14} />{conflict ? '查看暂存稿' : '预览新稿'}</Button>
        <Button variant="primary" className="h-8 px-3 text-[12px]" disabled={saving || conflict || !text.trim() || text.trim().length > 20_000} onClick={onSave}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}保存新稿并下载</Button>
        <Button variant="ghost" className="h-8 px-2.5 text-[12px]" disabled={saving} onClick={onDiscard}>放弃修改</Button>
      </div>
    </div>
    {(error || !text.trim() || text.trim().length > 20_000) && <p role="alert" className="mb-0 mt-2 text-[12px] text-danger">{error || (!text.trim() ? '新稿内容不能为空。' : '新稿不能超过 20000 字，请删减后保存。')}</p>}
  </div>
}

export function ResumeRevisionPreview({ open, baseText, text, onClose }: { open: boolean; baseText: string; text: string; onClose: () => void }) {
  const [compare, setCompare] = useState(false)
  const paragraphs = useMemo(() => resumeDocumentParagraphs(text), [text])
  return <Dialog open={open} onClose={onClose} label="新稿预览" panelClassName="flex max-h-[90dvh] w-[min(960px,calc(100%-32px))] flex-col border border-line-strong bg-surface">
    <div className="flex flex-none items-center justify-between gap-3 border-b border-line px-5 py-3">
      <strong className="text-[14px]">{compare ? '修改前后' : '新稿预览'}</strong>
      <div className="flex items-center gap-2"><Button variant="ghost" className="h-8 px-2 text-[12px]" onClick={() => setCompare((value) => !value)}>{compare ? '查看新稿' : '前后对照'}</Button><Button variant="ghost" className="h-8 px-2" aria-label="关闭预览" onClick={onClose}><X size={16} /></Button></div>
    </div>
    <p className="m-0 flex-none border-b border-line bg-surface-soft px-5 py-2 text-[12px] leading-relaxed text-text-secondary">导出为简洁单列 DOCX，原文件保留；不保留原 PDF 的排版。预览展示文字与层级，分页以 Word 为准。</p>
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      {compare ? <div className="grid gap-6 sm:grid-cols-2"><section><h3 className="mt-0 text-[12px] font-medium text-text-tertiary">修改前</h3><p className="m-0 whitespace-pre-wrap break-words text-[13px] leading-[1.8]">{baseText}</p></section><section><h3 className="mt-0 text-[12px] font-medium text-text-tertiary">修改后</h3><p className="m-0 whitespace-pre-wrap break-words text-[13px] leading-[1.8]">{text}</p></section></div>
        : <article className="mx-auto max-w-[680px] border border-line bg-white p-5 text-[#222] sm:p-10">{paragraphs.map((item, index) => item.kind === 'blank' ? <div key={index} className="h-3" /> : <p key={index} className={item.kind === 'name' ? 'mb-4 mt-0 whitespace-pre-wrap break-words text-[22px] font-semibold' : item.kind === 'heading' ? 'mb-2 mt-5 whitespace-pre-wrap break-words border-b border-[#ddd] pb-1 text-[15px] font-semibold' : 'my-1 whitespace-pre-wrap break-words text-[13px] leading-[1.8]'}>{item.text}</p>)}</article>}
    </div>
  </Dialog>
}
