'use client'

import { Check, CircleAlert, Info, X } from 'lucide-react'
import type { ToastTone } from '@/hooks/use-toast-queue'

type ToastProps = {
  message: string
  onDismiss: () => void
  tone?: ToastTone
}

export function Toast({ message, onDismiss, tone = 'info' }: ToastProps) {
  if (!message) return null

  return (
    <div
      className="fixed left-1/2 top-[68px] z-50 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2 rounded-lg border border-line-strong bg-white px-4 py-2.5 text-body text-text-primary shadow-card"
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {tone === 'error' ? <CircleAlert size={15} className="shrink-0 text-danger" /> : tone === 'success' ? <Check size={15} className="shrink-0 text-success" /> : <Info size={15} className="shrink-0 text-info" />}
      <span>{message}</span>
      <button
        type="button"
        className="ml-2 text-text-tertiary hover:text-text-primary bg-transparent"
        onClick={onDismiss}
        aria-label="关闭"
      >
        <X size={14} />
      </button>
    </div>
  )
}
