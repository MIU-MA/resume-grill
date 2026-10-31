'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { APPLICATION_STAGES, applicationStage, type ApplicationProgress } from '@/domain/application-progress'
import { listRecords, type SavedRecord } from '@/lib/storage'
import { listResumeDocuments, type ResumeDocument } from '@/features/resume/lib/resume-library'
import type { SubmissionSnapshot } from './application-tracker-storage'
import type { SavedJobPreparation } from './draft-state'
import { ApplicationProgressEditor } from './ApplicationProgressEditor'

export function JobDossier({ id, title, sourceUrl, preparation, submission, progress, deliveryStatus = 'draft', disabled, onSave, onOpenRecord, jobRequirements, delivery }: {
  id: string; title: string; sourceUrl: string; preparation?: SavedJobPreparation; submission?: SubmissionSnapshot
  progress?: ApplicationProgress; disabled: boolean; onSave: (change: Partial<ApplicationProgress>) => Promise<void>
  deliveryStatus?: string
  onOpenRecord?: (record: SavedRecord) => void; jobRequirements: ReactNode; delivery: ReactNode
}) {
  const [tab, setTab] = useState('job')
  const [records, setRecords] = useState<SavedRecord[]>([])
  const [documents, setDocuments] = useState<ResumeDocument[]>([])
  const [loadError, setLoadError] = useState('')
  const [round, setRound] = useState('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [editingInterview, setEditingInterview] = useState<string | null>(null)
  const stage = applicationStage(progress, deliveryStatus)
  useEffect(() => {
    let active = true
    void Promise.all([listRecords(), listResumeDocuments()]).then(([allRecords, allDocuments]) => {
      if (!active) return
      setRecords(allRecords.filter(record => record.analysis.jobContext?.applicationId === id))
      setDocuments(allDocuments.filter(document => document.jobContext?.applicationId === id))
    }).catch(() => { if (active) setLoadError('岗位练习记录读取失败，请关闭详情后重新打开。') })
    return () => { active = false }
  }, [id])
  const download = (file: File) => {
    const url = URL.createObjectURL(file)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.name; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <article className="mx-auto w-full max-w-[900px] p-5 text-[13px] sm:p-7" aria-label="岗位详情">
    <header className="mb-6"><div className="flex flex-wrap items-center gap-3"><h2 className="m-0 min-w-0 break-words text-[18px] font-semibold">{title}</h2><span className="workbench-status" data-tone={stage === 'offer' ? 'success' : stage === 'rejected' ? 'warning' : 'info'}>{stage ? APPLICATION_STAGES[stage] : '尚未记录进展'}</span></div>
      {sourceUrl && /^https:\/\//i.test(sourceUrl) && <a className="mt-2 inline-block text-[12px] text-text-secondary underline" href={sourceUrl} target="_blank" rel="noreferrer">查看招聘原文 ↗</a>}
      {(progress?.nextAction || progress?.interviewAt || progress?.followUpAt) && <p className="mb-0 mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] leading-relaxed text-text-secondary">{progress.interviewAt && <span>下次面试：{new Date(progress.interviewAt).toLocaleString('zh-CN')}</span>}{progress.followUpAt && <span>跟进：{new Date(progress.followUpAt).toLocaleString('zh-CN')}</span>}{progress.nextAction && <span>下一步：{progress.nextAction}</span>}</p>}
    </header>
    <div role="tablist" aria-label="岗位资料" className="mb-6 flex gap-5 overflow-x-auto border-b border-line">{[['job', '岗位要求'], ['delivery', '简历与投递'], ['interviews', '面试与复盘'], ['progress', '求职进展']].map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} aria-controls={`dossier-${id}-${key}`} id={`tab-${id}-${key}`} onClick={() => setTab(key)} className={`shrink-0 border-b-2 pb-3 text-[12px] ${tab === key ? 'border-brand font-medium text-text-primary' : 'border-transparent text-text-secondary'}`}>{label}</button>)}</div>
    <div role="tabpanel" id={`dossier-${id}-${tab}`} aria-labelledby={`tab-${id}-${tab}`}>
      {tab === 'job' && <div>{jobRequirements}{submission && <details className="mt-5"><summary className="cursor-pointer text-[12px] text-text-secondary">投递时的岗位要求 · {new Date(submission.at).toLocaleDateString('zh-CN')}</summary><p className="whitespace-pre-wrap break-words leading-[1.9] text-text-secondary">{submission.jobDescription || '投递时没有填写 JD。'}</p></details>}</div>}
      {tab === 'delivery' && <div className="space-y-5">
        <section className="border border-line bg-surface-soft p-4"><h3 className="mb-2 mt-0 text-[13px] font-medium">{submission?.channel === 'website' ? '登记时的简历' : '提交时的简历'}</h3>
          {submission?.attachment ? <><p className="break-words text-text-secondary">{submission.attachment.name} · {Math.max(1, Math.ceil(submission.attachment.size / 1024))} KB</p><Button variant="secondary" onClick={() => download(submission.attachment!)}>下载这份简历</Button>{submission.channel === 'website' && <p className="mb-0 text-[12px] text-text-tertiary">这是手动登记时选中的文件，请以官网实际提交的附件为准。</p>}</> : <p className="m-0 text-text-secondary">这条记录没有保存投递附件原件，不能用当前选中的简历替代。</p>}
        </section>
        {preparation?.attachment && preparation.attachment !== submission?.attachment && <details><summary className="cursor-pointer text-[12px] text-text-secondary">当前准备使用的简历</summary><button className="mt-3 underline" onClick={() => download(preparation.attachment!)}>{preparation.attachment.name}</button></details>}
        {delivery}
      </div>}
      {tab === 'progress' && <ApplicationProgressEditor key={id} value={progress} disabled={disabled} onSave={onSave} />}
      {tab === 'interviews' && <div className="space-y-7">
        <section><h3 className="mb-3 mt-0 text-[14px] font-medium">岗位练习</h3>{loadError && <p role="alert">{loadError}</p>}
          {!loadError && !records.length && <p className="text-text-secondary">还没有这个岗位的练习记录。在“岗位要求”中点击“准备面试”即可开始。</p>}
          {records.map(record => { const sessions = Object.values(record.sessions).flat(); return <div key={record.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3"><div className="min-w-0 flex-1"><div className="break-words">{record.analysis.sourceFile}</div><p className="mb-0 mt-1 text-[12px] text-text-secondary">{record.analysis.claims.length} 个练习要点 · 完成 {sessions.filter(session => session.status === 'done').length} 次练习 · {new Date(record.updatedAt).toLocaleDateString('zh-CN')}</p></div>{onOpenRecord && <Button variant="secondary" disabled={disabled} onClick={() => onOpenRecord(record)}>查看准备与复盘</Button>}</div> })}
          {!!documents.filter(document => document.review && !records.some(record => record.id === document.recordId)).length && <p className="text-[12px] text-text-secondary">已保存岗位简历检查。点击“岗位要求 → 检查简历”可继续。</p>}
        </section>
        <section><h3 className="mb-3 mt-0 text-[14px] font-medium">真实面试记录</h3>
          {(progress?.interviews ?? []).map(item => <div key={item.id} className="mb-4 border-l-2 border-line-strong pl-4"><strong>{item.title}</strong><span className="ml-3 text-[12px] text-text-tertiary">{item.at ? new Date(item.at).toLocaleString('zh-CN') : ''}</span><button disabled={saving} className="ml-3 text-[12px] underline" onClick={() => { setEditingInterview(item.id); setRound(item.title); setDate(item.at); setNotes(item.notes); setSaveError('') }}>修改记录</button><p className="whitespace-pre-wrap break-words leading-relaxed text-text-secondary">{item.notes}</p></div>)}
          <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (!round.trim() || !notes.trim()) return; setSaving(true); setSaveError(''); const entry = { id: editingInterview ?? crypto.randomUUID(), title: round.trim(), at: date, notes: notes.trim() }; void onSave({ interviews: editingInterview ? (progress?.interviews ?? []).map(item => item.id === editingInterview ? entry : item) : [...(progress?.interviews ?? []), entry] }).then(() => { setEditingInterview(null); setRound(''); setDate(''); setNotes('') }).catch(() => setSaveError('保存失败，内容还在，请重试。')).finally(() => setSaving(false)) }}>
            <div className="grid gap-3 sm:grid-cols-2"><label className="mail-label">面试轮次<input className="mail-input" required maxLength={120} placeholder="例如：技术一面" value={round} onChange={e => setRound(e.target.value)} /></label><label className="mail-label">面试时间（选填）<input className="mail-input" type="datetime-local" value={date} onChange={e => setDate(e.target.value)} /></label></div>
            <label className="mail-label">问题与复盘<textarea className="mail-input min-h-32" required maxLength={20000} placeholder="记录被问到的问题、没答清楚的地方，以及下次要补的内容。" value={notes} onChange={e => setNotes(e.target.value)} /></label>
            <Button type="submit" variant="secondary" disabled={disabled || saving}>{editingInterview ? '保存记录修改' : '保存面试记录'}</Button>{editingInterview && <button type="button" disabled={saving} className="ml-3 text-[12px] underline" onClick={() => { setEditingInterview(null); setRound(''); setDate(''); setNotes(''); setSaveError('') }}>取消修改</button>}{saveError && <p role="alert">{saveError}</p>}
          </form>
        </section>
      </div>}
    </div>
  </article>
}
