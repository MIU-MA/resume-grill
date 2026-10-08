'use client'

import { useState } from 'react'
import { Download, Eye, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { PdfPages } from './PdfPages'
import type { ResumePdfArtifact } from './lib/resume-pdf'

export function ResumeRevisionToolbar({ text, conflict, saving, draftStatus, pdfReady, error, onPreview, onSave, onDiscard }: {
  text: string; conflict: boolean; saving: boolean; draftStatus: 'saving' | 'saved' | 'error'
  pdfReady: boolean; error: string | null; onPreview: () => void; onSave: () => void; onDiscard: () => void
}) {
  return <div className="flex-none border-b border-line bg-brand-soft px-4 py-2.5 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[12px] text-text-secondary" role="status">{conflict ? '暂存稿对应的原文已变化，请查看暂存内容后放弃此稿。' : draftStatus === 'error' ? '修改未能暂存，请保持页面打开后重试保存。' : draftStatus === 'saving' ? '正在暂存修改…' : '修改已暂存；检查结果基于修改前内容。'}</span>
      <div className="flex flex-wrap items-center gap-1">
        <Button variant="ghost" className="h-8 px-2.5 text-[12px]" disabled={saving} onClick={onPreview}><Eye size={14} />{conflict ? '查看暂存稿' : '放大预览'}</Button>
        <Button variant="primary" className="h-8 px-3 text-[12px]" disabled={saving || conflict || !text.trim() || text.trim().length > 20_000 || !pdfReady} onClick={onSave}>{saving ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}保存 PDF 并下载</Button>
        <Button variant="ghost" className="h-8 px-2.5 text-[12px]" disabled={saving} onClick={onDiscard}>放弃修改</Button>
      </div>
    </div>
    {(error || !text.trim() || text.trim().length > 20_000) && <p role="alert" className="mb-0 mt-2 text-[12px] text-danger">{error || (!text.trim() ? '新稿内容不能为空。' : '新稿不能超过 20000 字，请删减后保存。')}</p>}
  </div>
}

export function ResumeRevisionPreview({ open, baseText, text, artifact, error, onClose }: { open: boolean; baseText: string; text: string; artifact: ResumePdfArtifact | null; error: string | null; onClose: () => void }) {
  const [compare, setCompare] = useState(false)
  return <Dialog open={open} onClose={onClose} label="新稿预览" panelClassName="flex max-h-[90dvh] w-[min(960px,calc(100%-32px))] flex-col border border-line-strong bg-surface">
    <div className="flex flex-none items-center justify-between gap-3 border-b border-line px-5 py-3">
      <strong className="text-[14px]">{compare ? '修改前后' : '新稿预览'}</strong>
      <div className="flex items-center gap-2"><Button variant="ghost" className="h-8 px-2 text-[12px]" onClick={() => setCompare((value) => !value)}>{compare ? '查看新稿' : '前后对照'}</Button><Button variant="ghost" className="h-8 px-2" aria-label="关闭预览" onClick={onClose}><X size={16} /></Button></div>
    </div>
    <p className="m-0 flex-none border-b border-line bg-surface-soft px-5 py-2 text-[12px] leading-relaxed text-text-secondary">预览与下载使用同一份 PDF。新稿采用单列排版，原文件保留。</p>
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      {compare ? <div className="grid gap-6 sm:grid-cols-2"><section><h3 className="mt-0 text-[12px] font-medium text-text-tertiary">修改前</h3><p className="m-0 whitespace-pre-wrap break-words text-[13px] leading-[1.8]">{baseText}</p></section><section><h3 className="mt-0 text-[12px] font-medium text-text-tertiary">修改后</h3><p className="m-0 whitespace-pre-wrap break-words text-[13px] leading-[1.8]">{text}</p></section></div>
        : artifact ? <PdfPages file={artifact.file} /> : <p role={error ? 'alert' : 'status'} className="text-[12px] text-text-secondary">{error ?? '正在生成 PDF…'}</p>}
    </div>
  </Dialog>
}
