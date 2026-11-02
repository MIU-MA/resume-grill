'use client'

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function DraftDialog({ children, disabled, onClose }: { children: ReactNode; disabled: boolean; onClose: () => void }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !disabled && !document.querySelector('[role="dialog"],dialog[open]')) onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [disabled, onClose])
  return <aside aria-label="查看与编辑投递邮件" className="resume-workbench fixed inset-y-0 right-0 z-40 w-[min(760px,100vw)] overflow-y-auto border-l border-line-strong bg-surface p-0 text-text-primary shadow-xl">
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-5 py-3"><span className="text-label font-medium">邮件与岗位详情 · 修改自动保存</span><Button variant="ghost" className="size-8 p-0" disabled={disabled} aria-label="关闭邮件详情" onClick={onClose}><X size={16} /></Button></header>
    {children}
  </aside>
}
