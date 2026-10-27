'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export function QuickMail({ disabled, onPreview }: { disabled: boolean; onPreview: (recipient: string) => void }) {
  const [recipient, setRecipient] = useState('')
  return <form className="border-b border-line px-5 py-4" aria-label="直接发邮件" onSubmit={event => { event.preventDefault(); onPreview(recipient) }}>
    <label htmlFor="quick-mail-recipient" className="mail-label mb-2">收件邮箱</label>
    <div className="flex flex-wrap gap-2">
      <input id="quick-mail-recipient" className="mail-input min-w-0 flex-1 basis-[240px]" type="email" required maxLength={254} placeholder="jobs@example.com" value={recipient} disabled={disabled} onChange={event => setRecipient(event.target.value)} />
      <Button type="submit" disabled={disabled || !recipient.trim()}>预览邮件</Button>
    </div>
    <p className="mb-0 mt-2 text-[12px] text-text-tertiary">使用上方的简历附件和发件邮箱。公司、岗位不用填，邮件可在发送前修改。</p>
  </form>
}
