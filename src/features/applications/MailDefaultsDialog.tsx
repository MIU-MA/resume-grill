'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { inferSmtpProvider } from '@/domain/mail-schema'
import { DEFAULT_BODY_TEMPLATE, DEFAULT_SUBJECT_TEMPLATE, mailDefaultsSchema, type MailDefaults } from './mail-defaults'

export function MailDefaultsDialog({ defaults, attachmentName, attachmentId, attachments, onChooseFile, onChooseAttachment, onSave, onClose }: {
  defaults: MailDefaults; attachmentName?: string; attachmentId?: string
  attachments: Array<{ id: string; file: File; updatedAt: number }>
  onChooseFile: () => void; onChooseAttachment: (id: string) => void
  onSave: (value: MailDefaults) => Promise<void>; onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState(defaults)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} aria-label="默认投递设置" onCancel={event => { if (busy) event.preventDefault(); else onClose() }} className="mail-dialog resume-workbench w-[740px] max-w-[calc(100vw-24px)] border border-line-strong bg-surface p-0 text-text-primary backdrop:bg-black/30">
    <header className="flex items-center justify-between border-b border-line px-5 py-4"><h2 className="m-0 text-[16px] font-semibold">默认投递设置</h2><Button variant="ghost" disabled={busy} className="size-8 p-0" aria-label="关闭投递设置" onClick={onClose}><X size={17} /></Button></header>
    <div className="space-y-5 p-5 text-[12px]">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="mail-label">发件人姓名<input className="mail-input" maxLength={80} value={value.sender.name} onChange={event => setValue(current => ({ ...current, sender: { ...current.sender, name: event.target.value } }))} /></label>
        <label className="mail-label">发件邮箱<input className="mail-input" type="email" value={value.sender.address} placeholder="QQ / 网易 163 邮箱" onChange={event => { const address = event.target.value; setValue(current => ({ ...current, sender: { ...current.sender, address, provider: inferSmtpProvider(address) ?? current.sender.provider } })) }} /></label>
      </div>
      <p className="!mt-2 text-[11px] leading-relaxed text-text-tertiary">姓名和邮箱保存在当前浏览器，用于生成草稿和下次连接时填入。实际发送使用已连接的邮箱；授权码不保存在这里。</p>
      <section className="border-y border-line py-4">
        <label className="mail-label">默认简历<select className="mail-input" value={attachmentId ?? ''} onChange={event => { if (event.target.value) onChooseAttachment(event.target.value) }}><option value="">{attachmentName ? `${attachmentName} · 当前附件` : '选择简历库中的原文件'}</option>{attachments.map(item => <option key={item.id} value={item.id}>{item.file.name} · {new Date(item.updatedAt).toLocaleDateString('zh-CN')}</option>)}</select></label>
        <button type="button" className="mt-2 text-accent underline" onClick={onChooseFile}>选择本地文件</button>
        <p className="mb-0 mt-2 text-[11px] text-text-tertiary">所选文件作为每批的默认附件，发送前仍可更换。</p>
      </section>
      <label className="mail-label">默认岗位（名单未填写岗位时使用）<input className="mail-input" maxLength={120} placeholder="例如：前端开发工程师" value={value.role} onChange={event => setValue(current => ({ ...current, role: event.target.value }))} /></label>
      <section>
        <div className="mb-2 flex items-center justify-between"><strong className="font-medium">邮件模板</strong><button type="button" className="text-text-tertiary underline" onClick={() => setValue(current => ({ ...current, subject: DEFAULT_SUBJECT_TEMPLATE, body: DEFAULT_BODY_TEMPLATE }))}>使用基础模板</button></div>
        <p className="mb-3 mt-0 text-[11px] text-text-tertiary">变量：{'{{公司}}、{{岗位}}、{{姓名}}、{{发件邮箱}}'}。已手动修改的邮件会保留。</p>
        <label className="mail-label">主题<input className="mail-input" maxLength={200} value={value.subject} onChange={event => setValue(current => ({ ...current, subject: event.target.value }))} /></label>
        <label className="mail-label mt-3">正文<textarea className="mail-input min-h-[180px] resize-y leading-[1.8]" maxLength={12000} value={value.body} onChange={event => setValue(current => ({ ...current, body: event.target.value }))} /></label>
      </section>
      {error && <p role="alert" className="text-danger">{error}</p>}
    </div>
    <footer className="flex justify-end gap-2 border-t border-line bg-surface-soft px-5 py-3"><Button variant="secondary" disabled={busy} onClick={onClose}>关闭</Button><Button loading={busy} onClick={async () => {
      const parsed = mailDefaultsSchema.safeParse(value)
      if (!parsed.success) { setError(parsed.error.issues[0].message); return }
      setBusy(true); setError('')
      try { await onSave(parsed.data); onClose() } catch (cause) { setError(cause instanceof Error ? cause.message : '设置未能保存') }
      finally { setBusy(false) }
    }}>保存并套用</Button></footer>
  </dialog>
}
