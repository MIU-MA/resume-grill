'use client'

import { useState } from 'react'
import { EXPERIENCE_KINDS, type WebsiteExperience } from '@/domain/website-experience'
import { Button } from '@/components/ui/Button'
import type { ExperienceDraft } from './website-experience-storage'

export function WebsiteExperienceEditor({ draft, source, disabled, onChange, onSave }: { draft: ExperienceDraft; source: string; disabled: boolean; onChange: (value: ExperienceDraft) => void; onSave: () => Promise<void> }) {
  const [copyMessage, setCopyMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const change = (items: WebsiteExperience[]) => onChange({ items, confirmed: false })
  return <details className="border-y border-line py-3">
    <summary className="cursor-pointer">教育、工作与项目经历 <span className="text-text-tertiary">· {draft.items.length} 段 · {draft.confirmed ? '已核对' : '待核对'}</span></summary>
    <p className="text-text-secondary">首次核对后随这份简历保存。官网无法自动填写时，可以复制单段经历。</p>
    <details><summary className="cursor-pointer text-text-tertiary">对照简历原文</summary><pre className="max-h-48 overflow-auto whitespace-pre-wrap bg-surface-soft p-3 font-sans">{source || '未取得简历文本，可手动添加经历。'}</pre></details>
    {draft.items.map((item, index) => <details key={item.id} className="mt-3 border border-line p-3" open={!item.organization}>
      <summary className="cursor-pointer font-medium">{EXPERIENCE_KINDS[item.kind]} · {item.organization || `第 ${index + 1} 段`}</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="mail-label">类型<select className="mail-input" disabled={disabled} value={item.kind} onChange={event => change(draft.items.map(value => value.id === item.id ? { ...value, kind: event.target.value as WebsiteExperience['kind'] } : value))}>{Object.entries(EXPERIENCE_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {(['organization', 'title', 'start', 'end'] as const).map(key => <label className="mail-label" key={key}>{{ organization: '学校 / 公司 / 项目名称', title: '专业 / 职位 / 项目角色', start: '开始时间（YYYY-MM）', end: '结束时间（YYYY-MM 或至今）' }[key]}<input className="mail-input" value={item[key]} maxLength={key === 'start' || key === 'end' ? 30 : 200} disabled={disabled} onChange={event => change(draft.items.map(value => value.id === item.id ? { ...value, [key]: event.target.value } : value))} /></label>)}
        <label className="mail-label sm:col-span-2">经历内容<textarea className="mail-input min-h-28" value={item.description} maxLength={5000} disabled={disabled} onChange={event => change(draft.items.map(value => value.id === item.id ? { ...value, description: event.target.value } : value))} /></label>
      </div>
      <div className="mt-3 flex gap-3"><Button variant="ghost" disabled={disabled} onClick={() => { void navigator.clipboard.writeText([item.organization, item.title, `${item.start} — ${item.end}`, item.description].filter(Boolean).join('\n')).then(() => setCopyMessage('已复制这段经历'), () => setCopyMessage('复制失败，请在上方选中文本复制')) }}>复制这段</Button><Button variant="ghost" disabled={disabled} onClick={() => change(draft.items.filter(value => value.id !== item.id))}>移除</Button></div>
    </details>)}
    {!draft.items.length && <p className="text-text-tertiary">没有识别到带时间范围的经历，请对照原文添加。</p>}
    <Button variant="secondary" className="mt-3" disabled={disabled || draft.items.length >= 30} onClick={() => change([...draft.items, { id: crypto.randomUUID(), kind: 'work', organization: '', title: '', start: '', end: '', description: '' }])}>添加一段经历</Button>
    <label className="mt-3 flex items-center gap-2"><input type="checkbox" disabled={disabled} checked={draft.confirmed} onChange={event => onChange({ ...draft, confirmed: event.target.checked })} />已核对以上经历，允许用于官网填写</label>
    <Button variant="secondary" className="mt-3" loading={saving} disabled={disabled} onClick={() => { setSaving(true); void onSave().then(() => setCopyMessage('经历已保存，下次使用这份简历时自动带入'), () => setCopyMessage('保存失败，请重试')).finally(() => setSaving(false)) }}>保存经历</Button>
    {copyMessage && <p role="status">{copyMessage}</p>}
  </details>
}
