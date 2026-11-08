'use client'
import { useEffect, useMemo, useState } from 'react'
import { listResumeDocuments, type ResumeDocument } from './lib/resume-library'
import { diffRewrite } from '@/features/report/lib/rewrite-diff'
import { resumeVersionParent as parent, resumeVersionRows } from './lib/resume-version-tree'
export function ResumeVersionTree({ onOpen }: { onOpen: (document: ResumeDocument) => void }) {
  const [documents, setDocuments] = useState<ResumeDocument[]>([]), [selected, setSelected] = useState(''), [base, setBase] = useState(''), [error, setError] = useState('')
  useEffect(() => { let active = true; void listResumeDocuments({ includeInternal: true }).then(values => { if (active) setDocuments(values) }).catch(() => setError('版本记录未能读取。')); return () => { active = false } }, [])
  const rows = useMemo(() => resumeVersionRows(documents), [documents])
  const chosen = documents.find(document => document.id === selected), original = documents.find(document => document.id === base)
  const diff = useMemo(() => chosen && original ? diffRewrite(original.review?.rawText ?? original.extracted.text, chosen.review?.rawText ?? chosen.extracted.text) : null, [chosen, original])
  return <section className="my-4 space-y-3 border border-line bg-white p-4 text-body" aria-label="简历版本关系">
    <p>主干和岗位版本分别保留。打开旧版本可继续修改，当前文件不会覆盖历史版本。</p>
    <ul className="max-h-64 space-y-2 overflow-auto">{rows.map(({ document, depth }) => <li key={document.id} className="border-l-2 border-line pl-3" style={{ marginLeft: Math.min(depth, 8) * 16 }}><button onClick={() => { setSelected(document.id); setBase(parent(document) ?? '') }}>{document.jobContext ? `${document.jobContext.company} / ${document.jobContext.role}` : parent(document) ? '修改稿' : '主干'} · {document.sourceFile} · {new Date(document.updatedAt).toLocaleDateString()}</button></li>)}</ul>
    {chosen && <><label className="mail-label">比较基准<select className="mail-input" value={base} onChange={event => setBase(event.target.value)}><option value="">选择一个版本</option>{documents.filter(document => document.id !== chosen.id).map(document => <option key={document.id} value={document.id}>{document.sourceFile} · {new Date(document.updatedAt).toLocaleString()}</option>)}</select></label><button onClick={() => onOpen(chosen)}>打开此版本并继续编辑</button></>}
    {diff && <div className="grid gap-3 md:grid-cols-2">{([['比较基准', diff.original], ['所选版本', diff.suggestion]] as const).map(([title, lines]) => <div key={title} className="max-h-80 overflow-auto border border-line p-3"><h3 className="mb-2 font-medium">{title}</h3>{lines.map((line, index) => <p key={index} className={`mb-2 whitespace-pre-wrap ${line.kind === 'removed' ? 'bg-danger-soft' : line.kind === 'added' ? 'bg-success-soft' : line.kind === 'changed' ? 'bg-warning-soft' : ''}`}>{line.text}</p>)}</div>)}</div>}
    {error && <p role="alert">{error}</p>}
  </section>
}
