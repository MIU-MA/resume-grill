'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { applicationTemplate, type CareerPage, type MailSender } from '@/domain/mail-schema'
import { draftIssues, websiteLinks, type Draft, type DraftField } from './draft-state'
import type { JobPreparationIntent } from '@/lib/job-preparation'
import { JobPreparationPanel } from './JobPreparationPanel'
import { PastedCareerForm } from './PastedCareerForm'

export function DraftEditor({ draft, sender, template, connected, busy, focusRequest, attachmentLabel, onPrepare, onUpdate, onRemove, onExtract, onSupplement, onConnect, onApplied }: {
  draft: Draft; sender?: MailSender | null; connected: boolean; busy: boolean
  template?: { subject: string; body: string } | null
  focusRequest: { field: DraftField; time: number } | null
  onUpdate: (change: Partial<Draft>) => void; onRemove: () => void
  onExtract: () => Promise<void>; onSupplement: (page: CareerPage) => void; onConnect: () => void; onApplied: (url: string) => void
  attachmentLabel: string; onPrepare: (intent: JobPreparationIntent) => void
}) {
  const root = useRef<HTMLDivElement>(null)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [sourceFailure, setSourceFailure] = useState<{ url: string; message: string } | null>(null)
  const [pasteSource, setPasteSource] = useState(false)
  const [emailMode, setEmailMode] = useState(false)
  const links = websiteLinks(draft)
  const [applicationUrl, setApplicationUrl] = useState(links[0]?.url ?? '')
  const websiteMode = links.length > 0 && !emailMode
  const issues = draftIssues(draft).filter(issue => !websiteMode || ['company', 'role', 'sourceUrl'].includes(issue.field))
  const sourcePage: CareerPage | undefined = draft.extraction?.url === draft.sourceUrl ? draft.extraction : undefined
  const focusField = (field: DraftField) => {
    if (field === 'sourceUrl') setSourceOpen(true)
    requestAnimationFrame(() => root.current?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${field}"]`)?.focus())
  }
  useEffect(() => { if (focusRequest) focusField(focusRequest.field) }, [focusRequest])
  const selectedApplication = links.some(link => link.url === applicationUrl) ? applicationUrl : links[0]?.url

  return <div ref={root} className="mail-editor mx-auto max-w-[860px] space-y-4 p-5 sm:p-6">
    <div className="flex items-center justify-between gap-3"><div><h2 className="m-0 text-[16px] font-semibold">{draft.company || '新岗位'}{draft.role ? ` / ${draft.role}` : ''}</h2><p className="mb-0 mt-1 text-[12px] text-text-tertiary">{websiteMode ? '在招聘官网完成申请后，回来记录进度。' : '核对收件人和邮件内容，发送前会统一预览。'}</p></div><Button variant="ghost" disabled={busy} className="h-7 shrink-0 px-2 text-[12px]" onClick={onRemove}><Trash2 size={13} />移除</Button></div>
    {issues.length > 0 && <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-line py-3 text-[12px]"><span className="text-text-tertiary">待补充</span>{issues.map(issue => <button className="text-accent underline underline-offset-4" key={issue.field} onClick={() => focusField(issue.field)}>{issue.label}</button>)}</div>}
    {websiteMode && <div className="border border-line bg-surface-soft p-4 text-[13px]">
      <div className="mb-2 font-medium">官网申请</div>
      <p className="my-2 text-[12px] leading-relaxed text-text-secondary">页面未提供招聘邮箱，已找到在线申请入口。此条不会进入邮件队列。</p>
      {links.length > 1 && <label className="mail-label mb-3">申请入口<select className="mail-input" value={selectedApplication} onChange={event => setApplicationUrl(event.target.value)}>{links.map(link => <option key={link.url} value={link.url}>{link.label || link.url}</option>)}</select></label>}
      <div className="flex flex-wrap items-center gap-3"><a href={selectedApplication} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent underline">打开申请页面<ExternalLink size={13} /></a><Button variant="secondary" className="h-8 px-3 text-[12px]" disabled={issues.length > 0 || !selectedApplication || busy} onClick={() => selectedApplication && onApplied(selectedApplication)}>我已完成官网申请</Button></div>
      <button className="mt-3 text-[12px] text-text-tertiary underline" onClick={() => { setEmailMode(true); focusField('recipient') }}>已有招聘邮箱，改为邮件投递</button>
    </div>}
    {sourcePage?.notes?.length ? <details className="text-[12px] leading-relaxed text-text-secondary"><summary className="cursor-pointer text-text-tertiary">查看网页读取说明</summary>{sourcePage.notes.map(note => <p className="my-2" key={note}>{note}</p>)}</details> : null}
    <div className="space-y-3 border-y border-line py-4">
        <div className="grid grid-cols-2 gap-3"><label className="mail-label">公司<input name="company" className="mail-input" maxLength={120} placeholder="公司名称" value={draft.company} onChange={event => onUpdate({ company: event.target.value })} /></label><label className="mail-label">岗位<input name="role" className="mail-input" maxLength={120} placeholder="岗位名称 / 编号" value={draft.role} onChange={event => onUpdate({ role: event.target.value })} /></label></div>
        {!websiteMode && <>
          <label className="mail-label">收件邮箱<input name="recipient" className="mail-input" type="email" placeholder="官网公开的招聘邮箱" value={draft.recipient} onChange={event => onUpdate({ recipient: event.target.value })} /></label>
          {!!sourcePage?.emails.length && <details className="text-[12px]"><summary className="cursor-pointer text-text-secondary">从页面中的 {sourcePage.emails.length} 个邮箱选择</summary><div className="mt-2 max-h-40 space-y-2 overflow-y-auto">{sourcePage.emails.map(candidate => <button className="block w-full border border-line bg-surface-soft p-2 text-left hover:border-line-strong" key={candidate.email} onClick={() => onUpdate({ recipient: candidate.email })}><span className="break-all font-medium">{candidate.email}</span><span className="mt-1 block text-[11px] leading-relaxed text-text-tertiary">{candidate.context}</span></button>)}</div><p className="mb-0 mt-2 text-text-tertiary">请核对上下文，避免选中客服等其他邮箱。</p></details>}
          {sourcePage && !sourcePage.emails.length && !links.length && <p className="m-0 text-[12px] leading-relaxed text-text-tertiary">未读到招聘邮箱或在线申请入口。请打开招聘页核对投递方式。</p>}
        </>}
      <details open={sourceOpen} onToggle={event => setSourceOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer text-[12px] text-text-tertiary">来源链接{draft.sourceUrl ? ' · 查看或修改' : ' · 选填'}</summary>
        <label className="mail-label mt-3">官网招聘页（选填）<div className="flex gap-2"><input name="sourceUrl" className="mail-input min-w-0 flex-1" type="url" placeholder="https://公司官网/招聘详情" value={draft.sourceUrl} onChange={event => { onUpdate({ sourceUrl: event.target.value }); setPasteSource(false) }} /><Button variant="secondary" className="h-9 shrink-0 px-3 text-[12px]" loading={busy} disabled={!draft.sourceUrl} onClick={() => {
          if (!connected) { onConnect(); return }
          const url = draft.sourceUrl
          void onExtract().then(() => { setSourceFailure(null); setPasteSource(false) }).catch(cause => { setSourceFailure({ url, message: cause instanceof Error ? cause.message : '读取失败' }); setSourceOpen(true) })
        }}>{connected ? '重新识别' : '连接后识别'}</Button></div></label>
        {sourceFailure?.url === draft.sourceUrl && <p role="alert" className="mb-1 mt-2 text-[12px] text-danger">{sourceFailure.message}</p>}
        {!pasteSource && <button className="mt-2 text-[12px] text-accent underline disabled:opacity-40" disabled={busy || !draft.sourceUrl} onClick={() => setPasteSource(true)}>粘贴正文补充</button>}
        {pasteSource && <PastedCareerForm key={draft.sourceUrl} url={draft.sourceUrl} disabled={busy} onCancel={() => setPasteSource(false)} onImported={page => { onSupplement(page); setPasteSource(false); setSourceFailure(null) }} />}
      </details>
    </div>
    <JobPreparationPanel jobDescription={draft.jobDescription ?? ''} attachmentLabel={attachmentLabel} busy={busy} onChange={jobDescription => onUpdate({ jobDescription })} onPrepare={onPrepare} />
    {!websiteMode && <div className="pt-1">
      <div className="mb-3 flex items-center justify-between gap-2"><span className="text-[13px] font-medium">邮件内容</span><button className="text-[12px] text-text-secondary underline disabled:opacity-40" disabled={!template && !sender?.name} onClick={() => {
        if (!draft.automatic && (draft.body || draft.subject) && !window.confirm('用默认模板替换当前主题和正文？')) return
        const content = template ?? applicationTemplate(sender!.name, draft.company, draft.role)
        onUpdate({ ...content, automatic: true })
      }}>重新套用模板</button></div>
      {!sender && draft.automatic && <p className="text-[12px] text-text-tertiary">设置默认发件人后会自动填好邮件，也可以先自行编辑。</p>}
      <label className="mail-label">主题<input name="subject" className="mail-input" maxLength={200} placeholder="应聘岗位-姓名" value={draft.subject} onChange={event => onUpdate({ subject: event.target.value })} /></label>
      <label className="mail-label mt-3">正文<textarea name="body" className="mail-input min-h-[180px] resize-y leading-[1.8]" maxLength={12000} placeholder="说明应聘岗位，可补充一两句相关经历。" value={draft.body} onChange={event => onUpdate({ body: event.target.value })} /></label>
    </div>}
  </div>
}
