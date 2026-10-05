'use client'

import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { readContactFile } from './contact-import'

export function ContactImporter({ disabled, slots, onImport }: { disabled: boolean; slots: number; onImport: (text: string) => string }) {
  const [input, setInput] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const file = useRef<HTMLInputElement>(null)
  return <section className="border-b border-line px-4 py-3 sm:px-5" aria-label="批量导入名单">
    <div className="flex flex-wrap items-start gap-2">
      <textarea aria-label="公司、岗位和招聘邮箱名单" className="mail-input min-h-[68px] min-w-0 flex-1 basis-full resize-y text-[12px] sm:basis-0" rows={2} maxLength={120000} disabled={disabled} placeholder={'粘贴名单，每行一个岗位；也可粘贴多段招聘正文\n示例科技 前端工程师 jobs@example.com'} value={input} onChange={event => { setInput(event.target.value); setMessage(''); setError('') }} />
      <Button disabled={disabled || !input.trim() || slots <= 0} onClick={() => {
        try { setMessage(onImport(input)); setInput(''); setError('') }
        catch (cause) { setError(cause instanceof Error ? cause.message : '无法整理名单') }
      }}>整理到清单</Button>
      <Button variant="ghost" disabled={disabled || slots <= 0} className="px-2 text-[12px]" onClick={() => file.current?.click()}><Upload size={14} />导入 CSV</Button>
      <input ref={file} hidden type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={async event => {
        const chosen = event.target.files?.[0]
        event.target.value = ''
        if (!chosen) return
        try { setInput(await readContactFile(chosen)); setMessage(`已读取 ${chosen.name}，点击「整理到清单」。`); setError('') }
        catch (cause) { setError(cause instanceof Error ? cause.message : '文件无法读取，请直接粘贴内容。') }
      }} />
    </div>
    <details className="mt-2 text-[11px] text-text-tertiary"><summary className="w-fit cursor-pointer">名单格式与正文示例</summary>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div><p className="mb-1 mt-0">CSV 表头支持中文或英文。来源链接和岗位要求选填。</p><pre className="m-0 overflow-x-auto border border-line bg-surface-soft p-2 leading-relaxed">{'公司,岗位,邮箱,来源链接\n示例科技,前端工程师,jobs@example.com,https://example.com/jobs/frontend'}</pre></div>
        <div><p className="mb-1 mt-0">多段招聘正文从「公司：」开始，或用 --- 分隔。</p><pre className="m-0 overflow-x-auto border border-line bg-surface-soft p-2 leading-relaxed">{'公司：示例科技\n岗位：前端工程师\n招聘邮箱：jobs@example.com\n岗位要求：熟悉 React 和 TypeScript'}</pre></div>
      </div>
    </details>
    {message && <p role="status" className="mb-0 mt-2 text-[12px] text-text-secondary">{message}</p>}
    {error && <p role="alert" className="mb-0 mt-2 text-[12px] text-danger">{error}</p>}
  </section>
}
