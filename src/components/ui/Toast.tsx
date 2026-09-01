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
      className="fixed left-1/2 top-[68px] z-50 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-2 rounded-lg border border-line-strong bg-white px-4 py-2.5 text-[14px] text-text-primary shadow-card"
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
