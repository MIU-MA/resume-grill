'use client'

import { useLayoutEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { RESUME_TEMPLATES, type ResumeTemplateId } from '@/domain/resume-template'

export function ResumeTemplatePicker({ value, disabled, onChange, canUseOriginal = false, initiallyCollapsed = false }: { value: ResumeTemplateId; disabled?: boolean; onChange: (template: ResumeTemplateId) => void; canUseOriginal?: boolean; initiallyCollapsed?: boolean }) {
  const optionsRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)
  useLayoutEffect(() => {
    const container = optionsRef.current
    const selected = selectedRef.current
    if (!container || !selected) return
    const left = selected.offsetLeft
    const right = left + selected.offsetWidth
    if (left < container.scrollLeft) container.scrollLeft = left
    else if (right > container.scrollLeft + container.clientWidth) container.scrollLeft = right - container.clientWidth
  }, [value])
  return <fieldset className="resume-template-picker" disabled={disabled}><legend>修改方式<span>{canUseOriginal ? <button type="button" disabled={disabled} aria-pressed={value === 'original'} onClick={() => onChange('original')}>原文件上修改</button> : '文字稿排版'}</span></legend><details className="resume-template-details" open={!initiallyCollapsed && value !== 'original'}><summary>重新排版{value !== 'original' ? ` · ${RESUME_TEMPLATES.find(template => template.id === value)?.name ?? ''}` : '（可选）'}</summary><div className="resume-template-options" ref={optionsRef}>
    {RESUME_TEMPLATES.map(template => <button type="button" key={template.id} ref={value === template.id ? selectedRef : undefined} className="resume-template-option" data-template={template.id} aria-label={`使用${template.name}模板`} aria-pressed={value === template.id} onClick={() => onChange(template.id)}>
      {/* Generated from the same PDF renderer as the user's exported file. */}
      <img src={`/resume-templates/${template.id}.webp`} alt="" width={52} height={74} loading="lazy" />
      <span><strong>{template.name}</strong><small>{template.description}</small></span>{value === template.id && <Check size={12} className="resume-template-check" />}
    </button>)}
  </div></details></fieldset>
}
