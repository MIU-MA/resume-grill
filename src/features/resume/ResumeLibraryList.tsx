import { FileText, Trash2 } from 'lucide-react'
import type { SavedRecord } from '@/lib/storage'
import type { ResumeDocument } from '@/features/resume/lib/resume-library'

import { resumeLibraryEntries } from './resume-library-entries'
import { useConfirmation } from '@/hooks/use-confirmation'
import { useState } from 'react'
import { useSessionState } from '@/hooks/use-session-state'

type Props = {
  records: SavedRecord[]
  documents: ResumeDocument[]
  onOpenRecord: (record: SavedRecord) => void
  onOpenDocument: (document: ResumeDocument) => void
  onDeleteRecord: (id: string) => Promise<void>
  onDeleteDocument: (id: string) => Promise<void>
}

export function ResumeLibraryList({ records, documents, onOpenRecord, onOpenDocument, onDeleteRecord, onDeleteDocument }: Props) {
  const [search, setSearch] = useSessionState('library-search', '', (value): value is string => typeof value === 'string')
  const [recent, setRecent] = useSessionState<Record<string, number>>('library-recent', {}, (value): value is Record<string, number> => !!value && typeof value === 'object' && !Array.isArray(value) && Object.values(value).every(item => typeof item === 'number'))
  const entries = resumeLibraryEntries(records, documents).filter(entry => !search.trim() || [entry.record?.analysis.candidate, entry.document?.sourceFile, entry.record?.analysis.sourceFile, entry.record?.analysis.role].filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => (recent[b.id] ?? 0) - (recent[a.id] ?? 0))
  const confirmation = useConfirmation()
  const [error, setError] = useState('')
  return <>{confirmation.dialog}<label className="mail-label py-3">搜索简历<input className="mail-input" placeholder="姓名、文件名或岗位 · 最近打开的排在前面" value={search} onChange={event => setSearch(event.target.value)} /></label>{error && <p role="alert" className="text-body text-danger">{error}</p>}<div className="max-h-[440px] divide-y divide-line overflow-y-auto">
    {entries.map(({ id, document, record, updatedAt }) => {
      const title = record?.analysis.candidate ?? document!.sourceFile
      const job = document?.jobContext ?? record?.analysis.jobContext
      const completed = Object.values(record?.sessions ?? {}).flat().filter(session => session.status === 'done').length
      const markRecent = () => setRecent(items => ({ ...items, [id]: Date.now() }))
      const open = () => { markRecent(); if (record) onOpenRecord(record); else onOpenDocument(document!) }
      return <div key={id} className="library-file-row flex items-center gap-3 px-3 py-4 hover:bg-surface-soft">
        <span className="library-file-icon max-sm:hidden"><FileText size={20} strokeWidth={1.5} /></span>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={open}>
          <strong className="block truncate text-label font-semibold">{title}</strong>
          {job && <span className="mt-1 block truncate text-label text-brand">{job.company} / {job.role} · 版本 {job.resumeVersion.slice(0, 8)}</span>}
          <span className="mt-1 block truncate text-label text-text-tertiary">{document?.sourceFile ?? record?.analysis.sourceFile} · {new Date(updatedAt).toLocaleDateString('zh-CN')}</span>
          <span className="mt-1 block text-label text-text-secondary"><span className="workbench-status" data-tone={document?.review?.diagnosis || record?.analysis.diagnosis ? 'success' : 'info'}>{document?.review?.diagnosis || record?.analysis.diagnosis ? '已检查' : '已导入'}</span>{record ? ` · 已练习 ${completed} 次` : ' · 尚未开始练习'}</span>
        </button>
        <div className="flex flex-none items-center gap-2 text-body">
          {document && <button type="button" className="px-1 py-2 text-text-secondary hover:text-text-primary" onClick={() => { markRecent(); onOpenDocument(document) }}>查看简历</button>}
          {record && <button type="button" className="px-1 py-2 text-brand" onClick={() => { markRecent(); onOpenRecord(record) }}>{Object.values(record.sessions).flat().some(session => session.status === 'in_progress') ? '继续面试' : '打开练习'}</button>}
          <button type="button" className="grid size-8 place-items-center text-text-tertiary hover:text-danger" aria-label={`删除 ${title}`} onClick={async () => {
            if (!await confirmation.confirm({ title: '删除简历', message: `将删除「${title}」及关联的检查文档和练习记录，此操作无法撤销。投递草稿中的附件会保留。`, confirmLabel: '删除简历与记录' })) return
            try { await (record ? onDeleteRecord(record.id) : onDeleteDocument(document!.id)); setError('') } catch { setError('删除未完成，请重试。') }
          }}><Trash2 size={14} /></button>
        </div>
      </div>
    })}
  </div></>
}
