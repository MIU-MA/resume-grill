'use client'

import type { ReactNode } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { MAIL_STATUS_LABELS, type MailJob } from '@/domain/mail-schema'
import { MAIL_STATUS_TONES, safeLink } from './mail-presentation'

export function MailJobDetails({ job, disabled, onAction, preparation }: { job: MailJob; disabled: boolean; onAction: (action: 'retry' | 'cancel' | 'confirm-sent') => void; preparation: ReactNode }) {
  return <article className="mx-auto max-w-[860px] p-5 text-[13px] sm:p-6">
    <div className="flex flex-wrap items-baseline gap-3"><h2 className="m-0 text-[17px] font-semibold">{job.company} / {job.role}</h2><span className="workbench-status text-[12px]" data-tone={MAIL_STATUS_TONES[job.status]}>{MAIL_STATUS_LABELS[job.status]}</span></div>
    <p className="mb-5 text-[12px] leading-relaxed text-text-tertiary">{job.detail ?? '按清单顺序发送。'}<br />更新于 {new Date(job.updatedAt).toLocaleString('zh-CN')}</p>
    {preparation}
    <dl className="mail-record grid grid-cols-[60px_minmax(0,1fr)] gap-x-3 gap-y-3 border-y border-line py-4 text-[12px]">
      <dt>发件人</dt><dd>{job.sender.name} &lt;{job.sender.address}&gt;</dd><dt>收件人</dt><dd>{job.recipient}</dd>
      <dt>来源链接</dt><dd>{job.sourceUrl ? <a href={safeLink(job.sourceUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">{job.sourceUrl}<ExternalLink size={12} className="shrink-0" /></a> : '名单导入，未提供链接'}</dd>
      <dt>附件</dt><dd>{job.attachment.name} · {Math.max(1, Math.ceil(job.attachment.size / 1024))} KB</dd>
      <dt>邮件编号</dt><dd className="font-mono text-[11px]">{job.messageId}</dd>
    </dl>
    <h3 className="mb-3 mt-5 text-[14px] font-medium">{job.subject}</h3><div className="whitespace-pre-wrap break-words leading-[1.9] text-text-secondary">{job.body}</div>
    {['queued', 'failed', 'uncertain'].includes(job.status) && <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
      {job.status === 'failed' && <Button disabled={disabled} variant="secondary" onClick={() => onAction('retry')}>重新加入队列</Button>}
      {job.status === 'uncertain' && <Button disabled={disabled} variant="secondary" onClick={() => onAction('confirm-sent')}>已核对，标记为已发送</Button>}
      <Button disabled={disabled} variant="ghost" onClick={() => onAction('cancel')}>取消本条</Button>
    </div>}
  </article>
}
