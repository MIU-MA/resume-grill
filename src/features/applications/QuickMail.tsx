'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export function QuickMail({ disabled, onPreview }: { disabled: boolean; onPreview: (recipient: string, jobDescription?: string) => void }) {
  const [recipient, setRecipient] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  return <form className="border-b border-line px-5 py-4" aria-label="直接发邮件" onSubmit={event => { event.preventDefault(); onPreview(recipient, jobDescription) }}>
    <label htmlFor="quick-mail-recipient" className="mail-label mb-2">收件邮箱</label>
    <div className="flex flex-wrap gap-2">
      <input id="quick-mail-recipient" className="mail-input min-w-0 flex-1 basis-[240px]" type="email" required maxLength={254} placeholder="jobs@example.com" value={recipient} disabled={disabled} onChange={event => setRecipient(event.target.value)} />
      <Button type="submit" disabled={disabled || !recipient.trim()}>{jobDescription.trim() ? '按 JD 修改简历' : '预览邮件'}</Button>
    </div>
    <details className="mt-3 text-[12px]"><summary className="cursor-pointer text-text-secondary">附上 JD，针对这个岗位修改简历（选填）</summary><label className="mail-label mt-3">岗位职责与要求<textarea className="mail-input min-h-[120px] resize-y leading-[1.8]" maxLength={12000} value={jobDescription} disabled={disabled} placeholder="粘贴 JD，生成修改稿后逐段核对。" onChange={event => setJobDescription(event.target.value)} /></label></details>
    <p className="mb-0 mt-2 text-[12px] text-text-tertiary">使用上方简历。公司、岗位不用填；有 JD 时可生成单独的投递版 PDF。</p>
  </form>
}
