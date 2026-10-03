'use client'

import { useState } from 'react'
import type { CareerPage } from '@/domain/mail-schema'
import { Button } from '@/components/ui/Button'
import { parsePastedCareer } from './pasted-career'

export function PastedCareerForm({ url, disabled, onImported, onCancel }: {
  url: string; disabled: boolean; onImported: (page: CareerPage) => void; onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  return <div className="mt-3 space-y-2 border-l-2 border-line-strong pl-3">
    <p className="m-0 break-all text-[11px] text-text-tertiary">来源：{url}</p>
    <label className="mail-label">招聘正文<textarea autoFocus className="mail-input min-h-32 resize-y text-[12px] leading-relaxed" value={text} maxLength={24000} disabled={disabled} onChange={event => { setText(event.target.value); setError('') }} placeholder="粘贴一个具体职位的公司、岗位名称、职责、要求和投递方式。" /></label>
    <div className="flex flex-wrap items-center gap-2">
      <Button className="h-8 px-3 text-[12px]" disabled={disabled || !text.trim()} onClick={() => {
        try { onImported(parsePastedCareer(url, text)); setError('') } catch (cause) { setError(cause instanceof Error ? cause.message : '正文未能整理，请重试。') }
      }}>整理正文</Button>
      <Button variant="ghost" className="h-8 px-2 text-[12px]" disabled={disabled} onClick={onCancel}>收起</Button>
      <span className="text-[11px] text-text-tertiary">在本机整理，无需连接执行器。</span>
    </div>
    {error && <p role="alert" className="m-0 text-[12px] text-danger">{error}</p>}
  </div>
}
