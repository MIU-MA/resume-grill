'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { APPLICATION_CHANNELS, fromDateInput, manualApplicationInputSchema, toDateInput, type ManualApplicationInput } from '@/domain/application-record'
import { APPLICATION_STAGES, type ApplicationStage } from '@/domain/application-progress'

export type ApplicationRecordValues = ManualApplicationInput & { stage: ApplicationStage }

const blank = (): ApplicationRecordValues => ({
  company: '',
  role: '',
  channel: 'website',
  appliedAt: Date.now(),
  sourceUrl: '',
  contact: '',
  note: '',
  stage: 'awaiting',
})

export function ApplicationRecordDialog({ mode, initial, allowNote = true, lockChannel = false, onClose, onSave }: {
  mode: 'add' | 'edit'
  initial?: ApplicationRecordValues
  allowNote?: boolean
  lockChannel?: boolean
  onClose: () => void
  onSave: (values: ApplicationRecordValues) => Promise<void> | void
}) {
  const [draft, setDraft] = useState<ApplicationRecordValues>(() => initial ?? blank())
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const change = (patch: Partial<ApplicationRecordValues>) => { setDraft(current => ({ ...current, ...patch })); setError('') }
  const submit = async () => {
    if (saving) return
    const input = {
      company: draft.company,
      role: draft.role,
      channel: draft.channel,
      appliedAt: draft.appliedAt,
      sourceUrl: draft.sourceUrl.trim(),
      contact: draft.contact,
      note: allowNote ? draft.note : '',
    }
    const parsed = manualApplicationInputSchema.safeParse(input)
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? '请检查填写内容。'); return }
    setSaving(true); setError('')
    try { await onSave({ ...parsed.data, stage: draft.stage }) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请重试。') }
    finally { setSaving(false) }
  }
  return <Dialog open onClose={() => { if (!saving) onClose() }} label={mode === 'add' ? '登记投递' : '编辑投递记录'} panelClassName="w-[min(620px,calc(100%-32px))] max-h-[calc(100dvh-40px)] overflow-y-auto border border-line bg-white p-5">
    <header className="mb-5">
      <h2 className="m-0 text-section font-semibold">{mode === 'add' ? '登记投递' : '编辑投递记录'}</h2>
      <p className="mb-0 mt-1 text-body leading-relaxed text-text-tertiary">用于官网直投、内推等没有草稿的投递。这里只记录信息，不会发送邮件或提交官网。</p>
    </header>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void submit() }}>
      <fieldset disabled={saving} className="m-0 min-w-0 space-y-4 border-0 p-0">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="mail-label">公司 *<input autoFocus className="mail-input" maxLength={120} required value={draft.company} onChange={event => change({ company: event.target.value })} placeholder="公司名称" /></label>
        <label className="mail-label">岗位<input className="mail-input" maxLength={120} value={draft.role} onChange={event => change({ role: event.target.value })} placeholder="岗位名称" /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="mail-label">投递渠道<select className="mail-input" disabled={lockChannel} value={draft.channel} onChange={event => change({ channel: event.target.value as ApplicationRecordValues['channel'] })}>{Object.entries(APPLICATION_CHANNELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label className="mail-label">投递日期<input className="mail-input" type="date" required value={toDateInput(draft.appliedAt)} onChange={event => { const appliedAt = fromDateInput(event.target.value); if (Number.isFinite(appliedAt)) change({ appliedAt }) }} /></label>
      </div>
      <label className="mail-label">岗位链接（选填）<input className="mail-input" type="url" maxLength={2048} value={draft.sourceUrl} onChange={event => change({ sourceUrl: event.target.value })} placeholder="https://公司官网/岗位详情" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="mail-label">联系人 / 邮箱（选填）<input className="mail-input" maxLength={200} value={draft.contact} onChange={event => change({ contact: event.target.value })} placeholder="HR 姓名或邮箱" /></label>
        <label className="mail-label">当前进展<select className="mail-input" value={draft.stage} onChange={event => change({ stage: event.target.value as ApplicationStage })}>{Object.entries(APPLICATION_STAGES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      {allowNote && <label className="mail-label">备注（选填）<textarea className="mail-input min-h-24 resize-y" maxLength={5000} value={draft.note} onChange={event => change({ note: event.target.value })} placeholder="例如：在官网提交，未收到确认邮件。" /></label>}
      {error && <p role="alert" className="m-0 text-body text-danger">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>取消</Button>
        <Button type="submit" loading={saving}>保存记录</Button>
      </div>
      </fieldset>
    </form>
  </Dialog>
}
