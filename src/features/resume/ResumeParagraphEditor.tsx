'use client'

import { useLayoutEffect, useRef } from 'react'
import { tailoringChangeKey, type TailoringSection, type TailoringPlan } from '@/domain/resume-tailoring'

type Props = {
  sections: TailoringSection[]; plan?: TailoringPlan; edits?: Record<string, string>; accepted?: ReadonlySet<string>
  selected: string | null; disabled: boolean
  onSelect: (key: string) => void; onChange: (key: string, text: string) => void; onReset: (key: string) => void
  onlySelected?: boolean
  originals?: Record<string, string>
}

export function ResumeParagraphEditor({ sections, plan, edits = {}, accepted, selected, disabled, onSelect, onChange, onReset, onlySelected, originals }: Props) {
  return <article className="tailoring-line-editor" aria-label="简历逐条编辑">
    {!onlySelected && <p className="tailoring-line-note">点击任意一条直接修改，修改会自动进入当前新稿。</p>}
    {sections.filter(section => !onlySelected || selected?.startsWith(`${section.id}:`)).map(section => <section key={section.id} aria-label={section.title}>
      <h3>{section.title}</h3>
      {section.lines.map((line, lineIndex) => {
        const key = tailoringChangeKey({ sectionId: section.id, lineIndex })
        if (onlySelected && selected !== key) return null
        const original = originals?.[key] ?? line
        const change = plan?.changes.find(change => tailoringChangeKey(change) === key)
        const value = Object.hasOwn(edits, key) ? edits[key] : change && accepted?.has(key) ? change.after : line
        const modified = value !== original
        const label = `${section.title}第 ${lineIndex + 1} 条`
        return selected === key ? <div className="tailoring-line-active" key={key}>
          <div className="tailoring-line-heading"><span>{label}</span>{modified && <button type="button" disabled={disabled} onClick={() => onReset(key)}>还原这条</button>}</div>
          <ParagraphInput label={`修改${label}`} value={value} disabled={disabled} onChange={text => onChange(key, text)} />
          {change && <details className="tailoring-line-suggestion"><summary>查看 AI 建议</summary><p>{change.after}</p><p>岗位要求：{change.requirement}</p><button type="button" disabled={disabled} onClick={() => onChange(key, change.after)}>使用这条建议</button></details>}
        </div> : <button key={key} type="button" className="tailoring-line" aria-label={`编辑${label}`} data-modified={modified} disabled={disabled} onClick={() => onSelect(key)}>
          <span>{value || '此条已删除'}</span><small>{modified ? '已修改' : '修改'}</small>
        </button>
      })}
    </section>)}
  </article>
}

function ParagraphInput({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (text: string) => void }) {
  const input = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => { input.current?.focus({ preventScroll: true }); input.current?.scrollIntoView?.({ block: 'nearest' }) }, [label])
  useLayoutEffect(() => { const field = input.current; if (field) { field.style.height = '0'; field.style.height = `${Math.max(92, field.scrollHeight)}px` } }, [value])
  return <textarea ref={input} aria-label={label} value={value} maxLength={3000} disabled={disabled} onChange={event => onChange(event.target.value)} />
}
