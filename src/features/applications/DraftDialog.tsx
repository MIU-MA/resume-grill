'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function DraftDialog({ children, disabled, onClose }: { children: ReactNode; disabled: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} aria-label="查看与编辑投递邮件" onCancel={event => { if (disabled) event.preventDefault(); else onClose() }} className="mail-dialog resume-workbench w-[940px] max-w-[calc(100vw-24px)] border border-line-strong bg-surface p-0 text-text-primary backdrop:bg-black/30">
    <header className="flex items-center justify-between border-b border-line px-5 py-3"><span className="text-[13px] font-medium">邮件与岗位详情 · 修改自动保存</span><Button variant="ghost" className="size-8 p-0" disabled={disabled} aria-label="关闭邮件详情" onClick={onClose}><X size={16} /></Button></header>
    {children}
  </dialog>
}
