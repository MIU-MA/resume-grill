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
  const isTopmost = () => {
    const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
    return dialogs.item(dialogs.length - 1) === panelRef.current?.parentElement
  }
  useClickOutside(panelRef, () => { if (isTopmost()) onClose() }, open)

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopmost()) return
      if (event.key === 'Escape') { event.preventDefault(); onClose() }
      if (event.key === 'Tab') {
        const fields = panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')
        if (!fields?.length) return
        const first = fields[0], last = fields[fields.length - 1]
        if (event.shiftKey && (document.activeElement === first || !panelRef.current?.contains(document.activeElement))) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && (document.activeElement === last || !panelRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus() }
      }
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
