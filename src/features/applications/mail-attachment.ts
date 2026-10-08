import { validResumeAttachment } from './draft-state'
import type { AttachmentSource, DraftStore, LibraryAttachment } from './mail-draft-storage'

/** Only follow a direct revision of the exact library version already selected. */
export function draftResumeAttachment(saved: DraftStore | undefined, library: LibraryAttachment[]): { file: File; source?: AttachmentSource } | null {
  const current = library.find(item => item.current)
  if (saved?.attachment) {
    if (!validResumeAttachment(saved.attachment)) return null
    const previous = library.find(item => item.id === saved.attachmentSource?.id)
    if (current && previous && current.revisionOf === previous.id && saved.attachmentSource?.updatedAt === previous.updatedAt) {
      return { file: current.file, source: { id: current.id, updatedAt: current.updatedAt } }
    }
    return { file: saved.attachment, source: saved.attachmentSource }
  }
  return current ? { file: current.file, source: { id: current.id, updatedAt: current.updatedAt } } : null
}

export async function encodeAttachment(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('无法读取简历附件，请重新选择'))
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.readAsDataURL(file)
  })
}
