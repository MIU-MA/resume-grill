'use client'

import { Button } from '@/components/ui/Button'
import type { AgentSnapshot, CareerPage, MailBatch } from '@/domain/mail-schema'
import type { MailDefaults } from './mail/lib/mail-defaults'
import type { Draft } from './mail/lib/draft-state'
import { QuickMail } from './mail/QuickMail'
import { ContactImporter } from './mail/ContactImporter'
import { LinkImporter } from './jobs/LinkImporter'

export type AddJobsMode = 'email' | 'contacts' | 'links'

/** The add-job form is a focused drawer, not another toolbar above the list. */
export function AddJobsDrawer({ open, onClose, mode, onModeChange, connected, busy, preview, hydrated, drafts, defaults, snapshot, pending, onConnect, onBusy, onPreview, onImportContacts, onRead, onImported, onOpenDefaults }: {
  open: boolean
  onClose: () => void
  mode: AddJobsMode
  onModeChange: (mode: AddJobsMode) => void
  connected: boolean
  busy: boolean
  preview: MailBatch | null
  hydrated: boolean
  drafts: Draft[]
  defaults: MailDefaults
  snapshot: AgentSnapshot | null
  pending: number
  onConnect: () => void
  onBusy: (busy: boolean) => void
  onPreview: (recipient: string, jobDescription?: string) => void
  onImportContacts: (text: string) => string
  onRead: (url: string) => Promise<CareerPage>
  onImported: (page: CareerPage) => void
  onOpenDefaults: () => void
}) {
  if (!open) return null
  const disabled = busy || !!preview || !!snapshot?.running || pending > 0 || !!snapshot?.fatalError
  return <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
    <div className="absolute inset-y-0 right-0 flex w-[min(760px,100vw)] flex-col overflow-y-auto border-l border-line-strong bg-surface" onClick={event => event.stopPropagation()}>
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-3">
        <strong className="text-section font-semibold">添加岗位</strong>
        <Button variant="link" className="text-label text-text-secondary" onClick={onClose}>关闭</Button>
      </header>
      <div className="mail-import-area flex-none">
        <div className="mail-input-modes flex flex-wrap items-center gap-x-4 gap-y-2 px-5 pt-3 text-body">
          <span className="mail-input-caption">添加投递</span>
          <button type="button" aria-pressed={mode === 'email'} disabled={busy} className={mode === 'email' ? 'font-semibold text-text-primary' : 'text-text-tertiary'} onClick={() => onModeChange('email')}>邮箱投递</button>
          <button type="button" aria-pressed={mode === 'links'} disabled={busy} className={mode === 'links' ? 'font-semibold text-text-primary' : 'text-text-tertiary'} onClick={() => onModeChange('links')}>官网链接</button>
          <button type="button" aria-pressed={mode === 'contacts'} disabled={busy} className={mode === 'contacts' ? 'font-semibold text-text-primary' : 'text-text-tertiary'} onClick={() => onModeChange('contacts')}>名单 / 招聘正文</button>
          {!defaults.sender.name && !snapshot?.sender?.name && <Button variant="link" className="ml-auto text-label" onClick={onOpenDefaults}>设置发件人，自动填好邮件</Button>}
        </div>
        {mode === 'email' && <QuickMail disabled={!hydrated || disabled} onPreview={onPreview} />}
        {mode === 'contacts' && <ContactImporter disabled={busy || !!preview} slots={20 - drafts.length} onImport={onImportContacts} />}
        {mode === 'links' && <LinkImporter onBusy={onBusy} existingUrls={drafts.filter(draft => (draft.extraction?.jobs?.length ?? 0) < 2).map(draft => draft.sourceUrl)} existingJobs={drafts.map(({ sourceUrl, role }) => ({ sourceUrl, role }))} slots={20 - drafts.length} connected={connected} onConnect={onConnect} read={onRead} onImported={onImported} />}
      </div>
    </div>
  </div>
}
