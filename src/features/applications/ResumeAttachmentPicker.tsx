'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { AttachmentSource, LibraryAttachment } from './mail-draft-storage'
import { savedDate } from './mail-presentation'

type Props = {
  attachment: File | null
  attachmentSource?: AttachmentSource
  libraryAttachments: LibraryAttachment[]
  libraryError: boolean
  disabled: boolean
  onRemove: () => void
  onChoose: (item: LibraryAttachment) => void
}

export function ResumeAttachmentPicker({ attachment, attachmentSource, libraryAttachments, libraryError, disabled, onRemove, onChoose }: Props) {
  return <section className="flex-none border-b border-line px-5 py-4 text-[12px]" aria-label="选择投递简历">
        <div className="mb-3 flex items-center gap-3"><strong className="text-[13px] font-medium">简历库中的原文件</strong>{attachment && <Button variant="ghost" className="ml-auto h-7 px-2 text-[12px]" disabled={disabled} onClick={() => { onRemove() }}><Trash2 size={12} />移除附件</Button>}</div>
        {libraryAttachments.length ? <div className="max-h-40 divide-y divide-line overflow-y-auto border-y border-line">{libraryAttachments.map(item => <button key={item.id} className={`flex w-full items-center justify-between gap-3 px-2 py-2.5 text-left hover:bg-surface-soft ${attachmentSource?.id === item.id ? 'bg-brand-soft' : ''}`} disabled={disabled} onClick={() => { onChoose(item) }}><span className="min-w-0 truncate">{item.file.name}{item.current ? ' · 当前简历' : ''}</span><span className="shrink-0 text-text-tertiary">{savedDate(item.updatedAt)} 导入 · {Math.ceil(item.file.size / 1024)} KB</span></button>)}</div> : <p className="my-2 text-text-secondary">简历库暂无可用原文件，可直接选择本地简历。</p>}
        {libraryError && <p role="alert" className="mt-2 text-danger">简历库读取失败，可重新打开页面或直接选择本地文件。</p>}
        <p className="mb-0 mt-3 text-[11px] leading-relaxed text-text-tertiary">支持 5 MB 以内的 PDF、DOCX、TXT。修改提取的文字不会更改附件；发送前请核对原文件版本。</p>
      </section>
}
