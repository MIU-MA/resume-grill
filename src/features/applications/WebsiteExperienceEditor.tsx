'use client'

import { useState } from 'react'
import type { WebsiteExperience } from '@/domain/website-experience'
import { ResumeExperienceFields } from '@/features/resume/ResumeExperienceFields'
import { Button } from '@/components/ui/Button'
import type { ExperienceDraft } from './website-experience-storage'

export function WebsiteExperienceEditor({ draft, source, disabled, onChange, onSave }: { draft: ExperienceDraft; source: string; disabled: boolean; onChange: (value: ExperienceDraft) => void; onSave: () => Promise<void> }) {
  const [copyMessage, setCopyMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const change = (items: WebsiteExperience[]) => onChange({ items, confirmed: false })
  return <details className="border-y border-line py-3">
    <summary className="cursor-pointer">教育、工作与项目经历 <span className="text-text-tertiary">· {draft.items.length} 段 · {draft.confirmed ? '已核对' : '待核对'}</span></summary>
    <p className="text-text-secondary">选填。勾选下方“已核对”后，才会把这些经历交给扩展；不勾选也可以先填写基本资料并上传简历。首次核对后随这份简历保存，官网无法自动填写时可复制单段经历。</p>
    <details><summary className="cursor-pointer text-text-tertiary">对照简历原文</summary><pre className="max-h-48 overflow-auto whitespace-pre-wrap bg-surface-soft p-3 font-sans">{source || '未取得简历文本，可手动添加经历。'}</pre></details>
    <ResumeExperienceFields items={draft.items} disabled={disabled} onChange={change} onCopyMessage={setCopyMessage} />
    <label className="mt-3 flex items-center gap-2"><input type="checkbox" disabled={disabled} checked={draft.confirmed} onChange={event => onChange({ ...draft, confirmed: event.target.checked })} />已核对以上经历，允许用于官网填写</label>
    <Button variant="secondary" className="mt-3" loading={saving} disabled={disabled} onClick={() => { setSaving(true); void onSave().then(() => setCopyMessage('经历已保存，下次使用这份简历时自动带入'), () => setCopyMessage('保存失败，请重试')).finally(() => setSaving(false)) }}>保存经历</Button>
    {copyMessage && <p role="status">{copyMessage}</p>}
  </details>
}
