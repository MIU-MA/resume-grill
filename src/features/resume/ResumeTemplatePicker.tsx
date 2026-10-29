'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { RESUME_TEMPLATES, type ResumeTemplateId } from '@/domain/resume-template'
import type { ResumePhoto } from '@/domain/resume-photo'
import { useResumePdf } from './hooks/use-resume-pdf'
import { PdfPages } from './PdfPages'

type Preview = { text: string; sourceFile: string; photo?: ResumePhoto | null }
type Props = {
  value: ResumeTemplateId
  disabled?: boolean
  onChange: (template: ResumeTemplateId) => void
  canUseOriginal?: boolean
  preview?: Preview
}

export function ResumeTemplatePicker({ value, disabled, onChange, canUseOriginal = false, preview }: Props) {
  const [open, setOpen] = useState(false)
  const [inspected, setInspected] = useState<Exclude<ResumeTemplateId, 'original'>>('classic')
  const trigger = useRef<HTMLButtonElement>(null)
  const selected = useRef<HTMLButtonElement>(null)
  const active = RESUME_TEMPLATES.find(template => template.id === inspected)!
  const current = RESUME_TEMPLATES.find(template => template.id === value)
  // Preview one layout locally. Browsing never changes a draft or calls the model.
  const pdf = useResumePdf(preview?.text ?? '', preview?.sourceFile ?? '', open && !!preview?.text.trim(), inspected, undefined, preview?.text, preview?.photo ?? null)

  useLayoutEffect(() => {
    if (!open) return
    selected.current?.focus({ preventScroll: true })
    selected.current?.scrollIntoView?.({ block: 'nearest' })
  }, [open])

  const close = () => { setOpen(false); trigger.current?.focus({ preventScroll: true }) }
  return <div className="resume-template-picker">
    <span className="resume-template-label">排版</span>
    {canUseOriginal && <button type="button" className="resume-original-option" disabled={disabled} aria-pressed={value === 'original'} onClick={() => onChange('original')}>原文件上修改</button>}
    <button ref={trigger} type="button" className="resume-template-trigger" disabled={disabled} aria-label="更换简历模板" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setInspected(value === 'original' ? 'classic' : value); setOpen(true) }}>
      {current ? <><img src={`/resume-templates/${current.id}.webp`} alt="" width={24} height={34} /><span>{current.name}</span></> : <span>更换模板</span>}
      <ChevronDown size={13} />
    </button>
    {current && <span className="resume-template-hint">重新排版</span>}

    <Dialog open={open} onClose={close} label="选择简历模板" panelClassName="resume-template-dialog">
      <header className="resume-template-dialog-header">
        <div><h2>选择模板</h2><p>点选查看效果，自动适配一页。</p></div>
        <Button variant="ghost" className="size-8 p-0" aria-label="关闭模板选择" onClick={close}><X size={17} /></Button>
      </header>
      <div className="resume-template-dialog-body">
        <div className="resume-template-options" role="group" aria-label="简历模板">
          {RESUME_TEMPLATES.map(template => <button type="button" key={template.id} ref={inspected === template.id ? selected : undefined} className="resume-template-option" data-template={template.id} aria-label={`预览${template.name}模板`} aria-pressed={inspected === template.id} onClick={() => setInspected(template.id)}>
            <img src={`/resume-templates/${template.id}.webp`} alt="" width={180} height={255} />
            <span><strong>{template.name}</strong><small>{template.description}</small></span>
            {inspected === template.id && <Check size={14} className="resume-template-check" />}
          </button>)}
        </div>
        <section className="resume-template-preview" aria-label="模板排版预览">
          <div className="resume-template-preview-heading"><strong>{active.name}</strong><span>{preview?.text.trim() ? '使用当前简历内容' : '示例内容'}{pdf.artifact ? ` · ${pdf.artifact.pageCount} 页` : ''}</span></div>
          <div className="resume-template-preview-pages" key={inspected}>
            {preview?.text.trim() ? pdf.artifact ? <PdfPages file={pdf.artifact.file} /> : <div role={pdf.error ? 'alert' : 'status'} className="resume-template-preview-status">{pdf.error ? <><p>{pdf.error}</p><Button variant="secondary" onClick={pdf.retry}>重试预览</Button></> : <><Loader2 size={20} className="animate-spin" /><p>正在排版…</p></>}</div>
              : <img src={`/resume-templates/${inspected}.preview.webp`} alt={`${active.name}模板完整样张`} width={900} height={1273} />}
          </div>
        </section>
      </div>
      <footer className="resume-template-dialog-footer">
        <span>原文件保留，修改另存为新稿。</span>
        <Button variant="ghost" onClick={close}>取消</Button>
        <Button disabled={disabled || (!!preview?.text.trim() && !pdf.artifact)} onClick={() => { onChange(inspected); close() }}>使用{active.name}模板</Button>
      </footer>
    </Dialog>
  </div>
}
