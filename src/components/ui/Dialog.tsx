'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useClickOutside } from '@/hooks/use-click-outside'

type DialogProps = {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
  panelClassName?: string
}

export function Dialog({
  open,
  onClose,
  label,
  children,
  panelClassName = '',
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  useClickOutside(panelRef, onClose, open)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30"
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        ref={panelRef}
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  )
}
