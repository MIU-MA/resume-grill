'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { MailBatch } from '@/domain/mail-schema'

export function MailPreview({ batch, onClose, onSend }: { batch: MailBatch; onClose: () => void; onSend: (batch: MailBatch) => Promise<void> }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} onCancel={e => { if (busy) e.preventDefault(); else onClose() }} className="mail-dialog resume-workbench flex-col w-[760px] max-w-[calc(100vw-24px)] border border-line-strong bg-white p-0 text-text-primary backdrop:bg-black/30">
    <header className="border-b border-line p-5"><h2 className="m-0 text-[17px] font-semibold">确认投递 · {batch.jobs.length} 封</h2><p className="mb-0 mt-2 break-all text-[12px] text-text-secondary">发件人：{batch.sender.name} &lt;{batch.sender.address}&gt;<br />每封附件：{batch.attachment.name}</p></header>
    <div className="max-h-[48dvh] divide-y divide-line overflow-y-auto">
      {batch.jobs.map((job, i) => <article key={job.id} className="p-5 text-[13px]">
        <h3 className="m-0 text-[14px] font-semibold">{i + 1}. {job.company} / {job.role}</h3>
        <p className="my-2 break-all text-text-secondary">收件人：{job.recipient}</p>
        <a className="block truncate text-[12px] text-text-tertiary underline" href={job.sourceUrl} target="_blank" rel="noreferrer">{job.sourceUrl}</a>
        <p className="mb-2 mt-4 font-medium">主题：{job.subject}</p>
        <div className="whitespace-pre-wrap break-words border-l-2 border-line pl-3 leading-[1.8] text-text-secondary">{job.body}</div>
      </article>)}
    </div>
    <footer className="border-t border-line bg-surface-soft p-5 text-[12px]">
      <label className="flex items-start gap-2 leading-relaxed"><input type="checkbox" className="mt-0.5" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy} />我已核对官网，确认以上邮箱接受对应岗位申请，并核对了正文和附件，同意逐封发送。</label>
      <p className="mb-3 mt-2 text-text-tertiary">发送后无法在工作台撤回。遇到错误会暂停，不会自动重试。</p>
      {error && <p role="alert" className="text-danger">{error}</p>}
      <div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={onClose}>返回修改</Button><Button loading={busy} disabled={!confirmed} onClick={async () => {
        setBusy(true); setError('')
        try { await onSend(batch) } catch (e) { setError(e instanceof Error ? e.message : '发送请求失败') }
        finally { setBusy(false) }
      }}>确认并发送 {batch.jobs.length} 封</Button></div>
    </footer>
  </dialog>
}
