'use client'

import { useState, type ReactNode } from 'react'
import { EXPERIENCE_KINDS, type WebsiteExperience } from '@/domain/website-experience'
import { Button } from '@/components/ui/Button'

function ExperienceDetails({ initiallyOpen, children }: { initiallyOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initiallyOpen)
  return <details className="mt-3 border border-line p-3" open={open} onToggle={event => setOpen(event.currentTarget.open)}>{children}</details>
}

/** The same fields are used when composing a resume and reviewing website autofill. */
export function ResumeExperienceFields({ items, disabled, onChange, onCopyMessage }: { items: WebsiteExperience[]; disabled?: boolean; onChange: (items: WebsiteExperience[]) => void; onCopyMessage?: (message: string) => void }) {
  const change = (id: string, patch: Partial<WebsiteExperience>) => onChange(items.map(item => item.id === id ? { ...item, ...patch } : item))
  return <>
    {items.map((item, index) => <ExperienceDetails key={item.id} initiallyOpen={!item.organization}>
      <summary className="cursor-pointer font-medium">{EXPERIENCE_KINDS[item.kind]} · {item.organization || `第 ${index + 1} 段`}</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="mail-label">类型<select className="mail-input" disabled={disabled} value={item.kind} onChange={event => change(item.id, { kind: event.target.value as WebsiteExperience['kind'] })}>{Object.entries(EXPERIENCE_KINDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {(['organization', 'title', 'start', 'end'] as const).map(key => <label className="mail-label" key={key}>{{ organization: '学校 / 公司 / 项目名称', title: '专业 / 职位 / 项目角色', start: '开始时间（YYYY-MM）', end: '结束时间（YYYY-MM 或至今）' }[key]}<input className="mail-input" value={item[key]} maxLength={key === 'start' || key === 'end' ? 30 : 200} disabled={disabled} onChange={event => change(item.id, { [key]: event.target.value })} /></label>)}
        <label className="mail-label sm:col-span-2">经历内容<textarea className="mail-input min-h-28" value={item.description} maxLength={5000} disabled={disabled} onChange={event => change(item.id, { description: event.target.value })} /></label>
      </div>
      <div className="mt-3 flex gap-3">{onCopyMessage && <Button variant="ghost" disabled={disabled} onClick={() => { void navigator.clipboard.writeText([item.organization, item.title, `${item.start} — ${item.end}`, item.description].filter(Boolean).join('\n')).then(() => onCopyMessage('已复制这段经历'), () => onCopyMessage('复制失败，请在上方选中文本复制')) }}>复制这段</Button>}<Button variant="ghost" disabled={disabled} onClick={() => onChange(items.filter(value => value.id !== item.id))}>移除</Button></div>
    </ExperienceDetails>)}
    <Button variant="secondary" className="mt-3" disabled={disabled || items.length >= 30} onClick={() => onChange([...items, { id: crypto.randomUUID(), kind: 'work', organization: '', title: '', start: '', end: '', description: '' }])}>添加一段经历</Button>
  </>
}
