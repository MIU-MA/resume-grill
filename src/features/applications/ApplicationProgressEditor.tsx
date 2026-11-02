'use client'

import { useState } from 'react'
import { APPLICATION_STAGES, emptyApplicationProgress, type ApplicationProgress, type ApplicationStage } from '@/domain/application-progress'
import { Button } from '@/components/ui/Button'

export function ApplicationProgressEditor({ value, disabled, onSave }: { value?: ApplicationProgress; disabled?: boolean; onSave: (changes: Partial<ApplicationProgress>) => Promise<void> }) {
  const [draft, setDraft] = useState(() => value ?? emptyApplicationProgress())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const field = (key: 'contact' | 'interviewAt' | 'nextAction' | 'followUpAt', label: string, type = 'text') => <label className="mail-label">{label}<input className="mail-input" type={type} maxLength={300} value={draft[key]} onChange={e => { setDraft(current => ({ ...current, [key]: e.target.value })); setMessage('') }} /></label>
  return <form className="space-y-5" onSubmit={event => {
    event.preventDefault(); setSaving(true); setMessage('')
    const { stage, contact, interviewAt, nextAction, followUpAt, note } = draft
    void onSave({ stage, contact, interviewAt, nextAction, followUpAt, note }).then(() => setMessage('已保存。')).catch(() => setMessage('保存失败，填写内容还在，请重试。')).finally(() => setSaving(false))
  }}>
    <fieldset disabled={disabled || saving} className="m-0 min-w-0 space-y-5 border-0 p-0">
      <div className="grid gap-4 sm:grid-cols-2"><label className="mail-label">求职进展<select className="mail-input" value={draft.stage} onChange={e => { setDraft(current => ({ ...current, stage: e.target.value as ApplicationStage })); setMessage('') }}>{Object.entries(APPLICATION_STAGES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>{field('contact', '联系人（选填）')}</div>
      <div className="grid gap-4 sm:grid-cols-2">{field('interviewAt', '下次面试时间（选填）', 'datetime-local')}{field('followUpAt', '跟进时间（选填）', 'datetime-local')}</div>
      {field('nextAction', '下一步（选填）')}
      <label className="mail-label">备注（选填）<textarea className="mail-input min-h-24" maxLength={12000} value={draft.note} onChange={e => { setDraft(current => ({ ...current, note: e.target.value })); setMessage('') }} placeholder="例如：HR 已回复，等部门确认面试时间。" /></label>
      <Button type="submit" variant="secondary">{saving ? '保存中…' : '保存进展'}</Button>
    </fieldset>
    {message && <p role="status" className="text-body text-text-secondary">{message}</p>}
    {!!value?.events.length && <details className="border-t border-line pt-4"><summary className="cursor-pointer text-label text-text-secondary">进展记录</summary><ol className="space-y-2 pl-5 text-body text-text-secondary">{[...value.events].reverse().map((item, index) => <li key={index}>{new Date(item.at).toLocaleString('zh-CN')} · {APPLICATION_STAGES[item.stage]}</li>)}</ol></details>}
  </form>
}
