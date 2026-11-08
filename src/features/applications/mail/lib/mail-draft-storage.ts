import { get, set } from 'idb-keyval'
import type { listResumeAttachments } from '@/features/resume/lib/resume-library'
import type { MailDefaults } from './mail-defaults'
import type { Draft, SavedJobPreparation, WebsiteApplication } from './draft-state'

export type AttachmentSource = { id: string; updatedAt: number }
export type LibraryAttachment = Awaited<ReturnType<typeof listResumeAttachments>>[number]
export type DraftStore = {
  drafts: Draft[]
  attachment: File | null
  attachmentSource?: AttachmentSource
  websiteApplications?: WebsiteApplication[]
  preparationByJob?: Record<string, SavedJobPreparation>
  defaults?: MailDefaults
  selectedIds?: string[]
}
export const MAIL_DRAFTS_KEY = 'mail-workbench:drafts:v1'

export function loadMailDrafts() { return get<DraftStore>(MAIL_DRAFTS_KEY) }

/** Serialize autosaves and explicit writes, allowing recovery after a failed write. */
export function createDraftWriter(save: (store: DraftStore) => Promise<void> = store => set(MAIL_DRAFTS_KEY, store)) {
  let pending = Promise.resolve()
  return (store: DraftStore, commit = save) => {
    const write = pending.catch(() => undefined).then(() => commit(store))
    pending = write
    return write
  }
}
