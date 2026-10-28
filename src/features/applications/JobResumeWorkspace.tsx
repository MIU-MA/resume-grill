'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { ArrowRight, FileText, Loader2, Mail, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PdfPages } from '@/features/resume/PdfPages'
import { tailoringChangeKey, tailoringSourceRanges, type TailoringPlan } from '@/domain/resume-tailoring'
import type { PdfTextBlock, ResumePdfArtifact } from '@/features/resume/lib/resume-pdf'
import { mapRevisionTarget } from '@/features/resume/resume-revision'
import { ResumeParagraphEditor } from './ResumeParagraphEditor'
import type { TailoringSession } from './job-resume-tailoring'
import { ResumeTemplatePicker } from '@/features/resume/ResumeTemplatePicker'
import { DEFAULT_RESUME_TEMPLATE, type ResumeTemplateId } from '@/domain/resume-template'

export type JobResumeView = 'source' | 'compare' | 'resume' | 'pdf'
type MailFields = { company: string; role: string; subject: string; body: string }
type Props = {
  fileName: string; recipient: string; session: TailoringSession | null
  text: string; accepted: ReadonlySet<string>; edits: Record<string, string>
  originalOrder: boolean; view: JobResumeView; artifact: ResumePdfArtifact | null
  fields: MailFields; manualMail: boolean; busy: boolean; error: string
  onField: (key: keyof MailFields, value: string) => void
  onAccept: (key: string) => void; onEdit: (key: string, text: string) => void
  onOrder: (original: boolean) => void; onView: (view: JobResumeView) => void
  onRefreshMail: () => void; onRetry: () => void; onClose: () => void; onSave: () => void
  template?: ResumeTemplateId; onTemplate?: (template: ResumeTemplateId) => void
  originalFile?: File
  generating?: boolean; suggestionError?: string; editingKey?: string | null
  onSelectLine?: (key: string) => void; onResetLine?: (key: string) => void; onDeselectLine?: () => void
}

export function JobResumeWorkspace(props: Props) {
  const { fileName, recipient, session, text, accepted, edits, originalOrder, view, artifact, fields, manualMail, busy, error } = props
  const saving = busy && !!session
  const focusEditor = (view === 'source' || view === 'pdf') && !!props.editingKey
  const ranges = useMemo(() => session ? tailoringSourceRanges(session.rawText, session.sections) : new Map<string, { start: number; end: number }>(), [session])
  const selectBlock = (block: PdfTextBlock) => {
    if (!session) return
    for (const [key, range] of ranges) {
      const mapped = mapRevisionTarget(session.rawText, text, range)
      if (mapped && mapped.start < block.end && mapped.end > block.start) { props.onSelectLine?.(key); return }
    }
  }
  const selectedRange = session && props.editingKey && ranges.get(props.editingKey)
  const mappedSelection = session && selectedRange ? mapRevisionTarget(session.rawText, text, selectedRange) : null
  const selectedStart = mappedSelection ? artifact?.pages.flatMap(page => page.blocks).find(block => block.start < mappedSelection.end && block.end > mappedSelection.start)?.start : undefined
  const changedCount = session ? session.sections.reduce((count, section) => count + section.lines.filter((line, lineIndex) => {
    const key = tailoringChangeKey({ sectionId: section.id, lineIndex })
    return Object.hasOwn(edits, key) ? edits[key] !== line : accepted.has(key)
  }).length, 0) : 0
  return <>
    <header className="tailoring-header">
      <div className="tailoring-file-icon"><FileText size={22} strokeWidth={1.5} /></div>
      <div className="min-w-0 flex-1">
        <div className="tailoring-eyebrow">投递清单 <span>/</span> 岗位版简历</div>
        <h2>{[fields.company, fields.role].filter(Boolean).join(' / ') || '核对简历修改'}</h2>
        <p title={fileName}>{fileName}</p>
      </div>
      {session && <span className="tailoring-count">已修改 <strong>{changedCount}</strong> 处</span>}
      <Button variant="ghost" className="size-8 shrink-0 p-0" aria-label="关闭" disabled={saving} onClick={props.onClose}><X size={18} /></Button>
    </header>
    <div className="tailoring-body">
      <section className="tailoring-review" aria-label="简历核对">
        <div className="tailoring-review-toolbar">
          <nav aria-label="简历查看方式" className="tailoring-tabs">
            {([...(props.originalFile ? [['source', '原简历'] as const] : []), ['resume', '逐条修改'], ['compare', 'AI 建议'], ['pdf', 'PDF 预览']] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={view === key} disabled={!session || busy} onClick={() => props.onView(key)}>{label}</button>)}
          </nav>
          {session && props.template !== 'original' && <label className="tailoring-order"><input type="checkbox" checked={originalOrder} disabled={busy} onChange={event => props.onOrder(event.target.checked)} />保留原章节顺序</label>}
        </div>
        <ResumeTemplatePicker value={props.template ?? DEFAULT_RESUME_TEMPLATE} canUseOriginal={!!props.originalFile} disabled={!session || busy} onChange={props.onTemplate ?? (() => {})} />
        <div className={`tailoring-review-scroll ${view !== 'compare' && session ? 'tailoring-canvas' : ''}`}>
          {!session ? <div className="tailoring-empty" role="status">
            {props.generating ? <Loader2 size={24} strokeWidth={1.5} className="animate-spin text-text-tertiary" /> : <FileText size={28} strokeWidth={1.3} className="text-text-tertiary" />}
            <h3>{props.generating ? '正在读取简历' : '原文件未能读取'}</h3>
            <p>{props.generating ? '读完即可编辑原文。' : '重新读取后可以继续修改。'}</p>
            {!props.generating && <Button variant="secondary" onClick={props.onRetry}>重试</Button>}
          </div> : view === 'source' && props.originalFile ? <div className="tailoring-pdf"><p className="tailoring-source-note">{changedCount ? artifact?.inputText === text ? '预览当前修改。点击文字可以继续编辑。' : error ? '当前显示原文件。修改尚未写入预览，请检查下方提示。' : '正在更新预览，修改已保留。' : '点击原文直接修改，也可以打开「逐条修改」。'}</p><PdfPages file={props.template === 'original' && artifact?.template === 'original' ? artifact.file : props.originalFile} artifact={props.template === 'original' && artifact?.template === 'original' ? artifact : undefined} selectedStart={selectedStart} disabled={busy} onSelect={selectBlock} /></div> : view === 'compare' ? <>
            <div className="tailoring-compare-heading"><span>原简历</span><span>本次修改 <ArrowRight size={12} /></span></div>
            {session.plan.changes.map((change, index) => {
              const key = tailoringChangeKey(change)
              const section = session.sections.find(item => item.id === change.sectionId)!
              return <ResumeChangeRow key={key} index={index} title={section.title} original={section.lines[change.lineIndex]} change={change} value={edits[key] ?? change.after} accepted={accepted.has(key)} disabled={busy} onAccept={() => props.onAccept(key)} onEdit={value => props.onEdit(key, value)} />
            })}
            {!session.plan.changes.length && <div className="tailoring-empty"><FileText size={28} strokeWidth={1.3} /><h3>{props.generating ? '正在对照 JD 整理建议' : '没有可用的 AI 建议'}</h3><p>可以直接逐条修改原文。</p><Button variant="secondary" onClick={() => props.onView('resume')}>逐条修改原文</Button></div>}
          </> : view === 'resume' ? <ResumeParagraphEditor sections={session.sections} plan={session.plan} edits={edits} accepted={accepted} selected={props.editingKey ?? null} disabled={busy} onSelect={props.onSelectLine ?? (() => {})} onChange={props.onEdit} onReset={props.onResetLine ?? (() => {})} /> : artifact ? <div className="tailoring-pdf"><PdfPages file={artifact.file} artifact={artifact} selectedStart={selectedStart} disabled={busy} onSelect={selectBlock} /></div> : <div className="tailoring-empty"><FileText size={28} strokeWidth={1.3} /><h3>{saving ? '正在生成 PDF' : '简历内容已修改'}</h3><p>更新预览后，即可查看这次会保存的文件。</p><Button variant="secondary" loading={saving} onClick={() => props.onView('pdf')}>更新 PDF 预览</Button></div>}
        </div>
      </section>
      <aside className="tailoring-delivery" aria-label="投递信息">
        <div className="tailoring-delivery-heading"><Mail size={15} strokeWidth={1.5} /><h3>{focusEditor ? '修改这条' : view === 'source' ? '修改建议' : '这次投递'}</h3>{focusEditor && <button type="button" disabled={busy} onClick={props.onDeselectLine}>返回建议</button>}</div>
        <div className="tailoring-delivery-scroll">
          {props.generating && <p role="status" className="tailoring-source-note">正在对照 JD 整理建议，原文可继续编辑。</p>}
          {props.suggestionError && <div role="status" className="tailoring-notices"><p>{props.suggestionError} 可以继续逐条修改原文。</p><button type="button" disabled={busy || props.generating} onClick={props.onRetry}>重试 AI 建议</button></div>}
          {!!session?.plan.notices?.length && <details className="tailoring-notices"><summary>有 {session.plan.notices.length} 项建议未采用</summary>{session.plan.notices.map((notice, index) => <p key={index}>{notice}</p>)}</details>}
          {focusEditor && session && <div className="tailoring-sidebar-editor"><ResumeParagraphEditor onlySelected sections={session.sections} plan={session.plan} edits={edits} accepted={accepted} selected={props.editingKey ?? null} disabled={busy} onSelect={props.onSelectLine ?? (() => {})} onChange={props.onEdit} onReset={props.onResetLine ?? (() => {})} /></div>}
          {view === 'source' && !focusEditor && session && <div className="tailoring-suggestions">{session.plan.changes.map((change, index) => {
            const key = tailoringChangeKey(change), section = session.sections.find(item => item.id === change.sectionId)!
            return <ResumeChangeRow key={key} index={index} title={section.title} original={section.lines[change.lineIndex]} change={change} value={edits[key] ?? change.after} accepted={accepted.has(key)} disabled={busy} onAccept={() => props.onAccept(key)} onEdit={value => props.onEdit(key, value)} />
          })}{!session.plan.changes.length && !props.generating && <p className="tailoring-source-note">可以点击原文逐条修改，或直接使用原简历。</p>}</div>}
          <details className="tailoring-mail-details" open={view !== 'source' && !focusEditor}><summary hidden={view !== 'source' && !focusEditor}>随附邮件与投递信息</summary>
          <dl className="tailoring-recipient"><dt>收件邮箱</dt><dd>{recipient || '在邮件预览时核对'}</dd></dl>
          <div className="tailoring-job-fields">
            <label className="mail-label">公司<span className="sr-only">（选填）</span><input className="mail-input" value={fields.company} maxLength={120} placeholder="选填" disabled={!session || busy} onChange={event => props.onField('company', event.target.value)} /></label>
            <label className="mail-label">岗位<span className="sr-only">（选填）</span><input className="mail-input" value={fields.role} maxLength={120} placeholder="选填" disabled={!session || busy} onChange={event => props.onField('role', event.target.value)} /></label>
          </div>
          <section aria-label="随附邮件" className="tailoring-mail">
            <div className="tailoring-section-title"><h3>随附邮件</h3><span>可直接修改</span></div>
            <label className="mail-label">邮件主题<input className="mail-input" value={fields.subject} maxLength={200} disabled={!session || busy} onChange={event => props.onField('subject', event.target.value)} /></label>
            <label className="mail-label">正文<textarea className="mail-input" value={fields.body} maxLength={12000} disabled={!session || busy} onChange={event => props.onField('body', event.target.value)} /></label>
            {manualMail ? <div className="tailoring-mail-note"><span>已保留手写正文。</span><button type="button" disabled={busy} onClick={props.onRefreshMail}>按当前简历更新正文</button></div> : <p className="tailoring-mail-note">正文随已采用的修改一起更新。</p>}
          </section>
          </details>
          {!!session?.plan.gaps.length && <details className="tailoring-gaps"><summary>还有 {session.plan.gaps.length} 项要求未体现</summary><div>{session.plan.gaps.map((gap, index) => <p key={index}>{gap}</p>)}</div></details>}
        </div>
      </aside>
    </div>
    {error && <p role="alert" className="tailoring-error">{error}{session && <span> 原文仍可逐条修改。</span>}</p>}
    <footer className="tailoring-footer"><div><span className="tailoring-footer-label">保存为独立 PDF</span><p title={artifact?.file.name ?? fileName}>{artifact?.file.name ?? '原简历保留，只替换这封邮件的附件。'}</p></div><Button disabled={!session || busy} loading={saving} onClick={props.onSave}>保存并用于这封邮件<ArrowRight size={14} /></Button></footer>
  </>
}

function ResumeChangeRow({ index, title, original, change, value, accepted, disabled, onAccept, onEdit }: {
  index: number; title: string; original: string; change: TailoringPlan['changes'][number]
  value: string; accepted: boolean; disabled: boolean; onAccept: () => void; onEdit: (text: string) => void
}) {
  const input = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const field = input.current
    if (!field) return
    const fit = () => { field.style.height = '0'; field.style.height = `${Math.max(88, field.scrollHeight)}px` }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    let width = field.getBoundingClientRect().width
    const observer = new ResizeObserver(([entry]) => { if (entry.contentRect.width !== width) { width = entry.contentRect.width; fit() } })
    observer.observe(field)
    return () => observer.disconnect()
  }, [value, accepted])
  return <article className="tailoring-change" data-accepted={accepted}>
    <div className="tailoring-change-title"><span><span className="tailoring-index">{String(index + 1).padStart(2, '0')}</span>{title}</span><label><input type="checkbox" aria-label={`采用第 ${index + 1} 处修改`} checked={accepted} disabled={disabled} onChange={onAccept} />采用修改</label></div>
    <div className="tailoring-change-columns"><div className="tailoring-original"><span className="tailoring-mobile-label">原简历</span><p>{original}</p></div><div className="tailoring-replacement"><label className="sr-only" htmlFor={`tailoring-edit-${index}`}>第 {index + 1} 处修改稿</label><span className="tailoring-mobile-label">本次修改</span><textarea id={`tailoring-edit-${index}`} ref={input} rows={3} value={value} maxLength={3000} disabled={disabled} onChange={event => onEdit(event.target.value)} /></div></div>
    <details className="tailoring-reason"><summary>{change.reason}</summary><p>岗位要求：{change.requirement}</p></details>
  </article>
}
