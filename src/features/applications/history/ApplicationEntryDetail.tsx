'use client'

import { ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { ApplicationProgress } from '@/domain/application-progress'
import { MAIL_STATUS_LABELS } from '@/domain/mail-schema'
import { applicationEntryChannel, applicationEntryStatus, applicationEntryTitle, type ApplicationEntry } from './lib/application-entry'
import { ApplicationProgressEditor } from './ApplicationProgressEditor'
import { MailJobDetails } from '../mail/MailJobDetails'
import { MAIL_STATUS_TONES, savedDate, savedDay, safeLink } from '../mail/lib/mail-presentation'

export function ApplicationEntryDetail({ entry, progress, disabled, onEdit, onDelete, onSaveProgress, onMailAction, onReturnToDrafts }: {
  entry: ApplicationEntry
  progress?: ApplicationProgress
  disabled: boolean
  onEdit: () => void
  onDelete: () => void
  onSaveProgress: (changes: Partial<Omit<ApplicationProgress, 'events' | 'updatedAt'>>) => Promise<void>
  onMailAction: (job: NonNullable<ApplicationEntry['mail']>, action: 'retry' | 'cancel' | 'confirm-sent') => void
  onReturnToDrafts?: () => void
}) {
  const status = applicationEntryStatus(entry, progress)
  const link = entry.sourceUrl ? safeLink(entry.sourceUrl) : undefined
  return <article className="space-y-5 p-5 text-body" aria-label="投递记录详情">
    <header className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="m-0 break-words text-section font-semibold">{applicationEntryTitle(entry)}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="workbench-status" data-tone={status.tone}>{status.label}</span>
            <span className="workbench-status" data-tone="neutral">{applicationEntryChannel(entry)}</span>
            {entry.kind === 'mail' && entry.mail && status.label !== MAIL_STATUS_LABELS[entry.mail.status] && <span className="workbench-status" data-tone={MAIL_STATUS_TONES[entry.mail.status]}>{MAIL_STATUS_LABELS[entry.mail.status]}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {entry.kind !== 'mail' && <Button variant="secondary" className="h-8 px-3 text-label" disabled={disabled} onClick={onEdit}><Pencil size={13} />编辑</Button>}
          <Button variant="ghost" className="h-8 px-3 text-label text-text-secondary" disabled={disabled} onClick={onDelete}><Trash2 size={13} />{entry.kind === 'mail' ? '从记录中隐藏' : '删除'}</Button>
        </div>
      </div>
      <p className="m-0 text-meta leading-relaxed text-text-tertiary">{entry.kind === 'mail' ? '邮件发送状态来自本机执行器，求职进展由你记录。' : '投递结果由你登记。'}</p>
    </header>

    <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-2.5 border-y border-line py-4">
      <dt className="text-text-tertiary">{entry.kind === 'mail' && entry.mail?.status !== 'sent' ? '创建时间' : '投递时间'}</dt><dd className="m-0">{savedDay(entry.appliedAt)}</dd>
      <dt className="text-text-tertiary">最近更新</dt><dd className="m-0">{savedDate(Math.max(entry.updatedAt, progress?.updatedAt ?? 0))}</dd>
      <dt className="text-text-tertiary">联系人</dt><dd className="m-0 break-all">{entry.contact || '未填写'}</dd>
      <dt className="text-text-tertiary">岗位链接</dt><dd className="m-0 break-all">{link ? <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent underline">打开岗位<ExternalLink size={12} /></a> : '未填写'}</dd>
      {entry.kind === 'manual' && entry.manual?.note && <><dt className="text-text-tertiary">备注</dt><dd className="m-0 whitespace-pre-wrap break-words leading-relaxed">{entry.manual.note}</dd></>}
    </dl>

    {entry.kind === 'mail' && entry.mail && <MailJobDetails embedded heading={false} job={entry.mail} disabled={disabled} onAction={action => onMailAction(entry.mail!, action)} preparation={null} />}

    {entry.kind === 'website' && <section className="border border-line bg-surface-soft p-4">
      <p className="m-0 leading-relaxed text-text-secondary">这条记录表示你已在官网完成申请。工作台没有发送邮件，也没有读取官网的申请结果。</p>
      {onReturnToDrafts && <Button variant="secondary" className="mt-3" disabled={disabled} onClick={onReturnToDrafts}>移回待投递，重新编辑</Button>}
    </section>}

    {entry.kind !== 'mail' || entry.mail?.status === 'sent' || progress
      ? <ApplicationProgressEditor key={entry.id} value={progress} disabled={disabled} onSave={onSaveProgress} />
      : <p className="text-label leading-relaxed text-text-tertiary">邮件发出后，可以在这里记录回复和面试进展。</p>}
  </article>
}
