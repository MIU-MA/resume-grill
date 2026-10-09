'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { JobPreparationIntent } from '@/domain/job-preparation'

export function JobPreparationPanel({ jobDescription, attachmentLabel, busy, onChange, onPrepare }: {
  jobDescription: string
  attachmentLabel: string
  busy: boolean
  onChange: (value: string) => void
  onPrepare: (intent: JobPreparationIntent) => void
}) {
  const [open, setOpen] = useState(false)
  const [missing, setMissing] = useState(false)
  const input = useRef<HTMLTextAreaElement>(null)
  const prepare = (intent: JobPreparationIntent) => {
    if (!jobDescription.trim()) {
      setOpen(true); setMissing(true)
      requestAnimationFrame(() => input.current?.focus())
      return
    }
    setMissing(false)
    onPrepare(intent)
  }
  return <section className="border-y border-line py-4" aria-label="针对岗位准备">
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-auto text-[13px] font-medium">针对这个岗位</span>
      <Button variant="secondary" className="h-8 px-3 text-[12px]" disabled={busy} onClick={() => prepare('diagnosis')}>检查简历</Button>
      <Button variant="secondary" className="h-8 px-3 text-[12px]" disabled={busy} onClick={() => prepare('interview')}>准备面试</Button>
    </div>
    <p className="mb-2 mt-2 break-words text-[11px] leading-relaxed text-text-tertiary">{attachmentLabel}</p>
    <details open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer text-[12px] text-text-secondary">岗位要求 · {jobDescription.trim() ? '已填写，查看或修改' : '待补充'}</summary>
      <label className="mail-label mt-3">职责与任职要求<textarea ref={input} name="jobDescription" className="mail-input min-h-[150px] resize-y leading-[1.8]" maxLength={12000} placeholder="粘贴招聘页里的职责和要求，检查简历、练面试时会用到。" value={jobDescription} onChange={event => { onChange(event.target.value); setMissing(false) }} /></label>
      {missing && <p role="alert" className="mb-0 mt-2 text-[12px] text-warning">先粘贴岗位要求。</p>}
    </details>
  </section>
}
