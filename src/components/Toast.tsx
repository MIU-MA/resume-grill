'use client'

import { Check, X } from 'lucide-react'

type ToastProps = {
  message: string
  onDismiss: () => void
}

export function Toast({ message, onDismiss }: ToastProps) {
  if (!message) return null

  return (
    <div
      className="fixed top-[72px] left-1/2 z-50 flex max-w-[520px] -translate-x-1/2 items-center gap-2 rounded-lg border border-border-strong bg-white px-4 py-2.5 text-[14px] text-text-primary shadow-[0_1px_3px_rgba(16,24,40,0.04)]"
      role="status"
    >
      <Check size={15} className="text-success" />
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
