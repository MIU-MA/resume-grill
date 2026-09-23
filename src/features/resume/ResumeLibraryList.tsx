import { FileText, Trash2 } from 'lucide-react'
import type { SavedRecord } from '@/lib/storage'
import type { ResumeDocument } from '@/lib/resume-library'

import { resumeLibraryEntries } from './resume-library-entries'

type Props = {
  records: SavedRecord[]
  documents: ResumeDocument[]
  onOpenRecord: (record: SavedRecord) => void
  onOpenDocument: (document: ResumeDocument) => void
  onDeleteRecord: (id: string) => Promise<void>
  onDeleteDocument: (id: string) => Promise<void>
}

export function ResumeLibraryList({ records, documents, onOpenRecord, onOpenDocument, onDeleteRecord, onDeleteDocument }: Props) {
  const entries = resumeLibraryEntries(records, documents)
  return <div className="max-h-[440px] divide-y divide-line overflow-y-auto">
    {entries.map(({ id, document, record, updatedAt }) => {
      const title = record?.analysis.candidate ?? document!.sourceFile
      const completed = Object.values(record?.sessions ?? {}).flat().filter(session => session.status === 'done').length
      const open = () => record ? onOpenRecord(record) : onOpenDocument(document!)
      return <div key={id} className="flex items-center gap-3 px-3 py-4 hover:bg-surface-soft">
        <FileText size={19} className="flex-none text-text-tertiary max-sm:hidden" />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={open}>
          <strong className="block truncate text-[14px] font-semibold">{title}</strong>
          <span className="mt-1 block truncate text-[12px] text-text-tertiary">{document?.sourceFile ?? record?.analysis.sourceFile} · {new Date(updatedAt).toLocaleDateString('zh-CN')}</span>
          <span className="mt-1 block text-[12px] text-text-secondary">{document?.review?.diagnosis || record?.analysis.diagnosis ? '已检查' : '已导入'}{record ? ` · 已练习 ${completed} 次` : ' · 尚未开始练习'}</span>
        </button>
        <div className="flex flex-none items-center gap-2 text-[12px]">
          {document && <button type="button" className="px-1 py-2 text-text-secondary hover:text-text-primary" onClick={() => onOpenDocument(document)}>查看简历</button>}
          {record && <button type="button" className="px-1 py-2 text-brand" onClick={() => onOpenRecord(record)}>继续练习</button>}
          <button type="button" className="grid size-8 place-items-center text-text-tertiary hover:text-danger" aria-label={`删除 ${title}`} onClick={() => {
            if (!window.confirm(`删除简历库中的「${title}」及关联练习记录？投递草稿中的附件会保留。`)) return
            void (record ? onDeleteRecord(record.id) : onDeleteDocument(document!.id))
          }}><Trash2 size={14} /></button>
        </div>
      </div>
    })}
  </div>
}
