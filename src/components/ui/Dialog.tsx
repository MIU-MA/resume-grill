'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useClickOutside } from '@/hooks/use-click-outside'
const modalStack: HTMLElement[] = []
let originalOverflow = ''

type DialogProps = {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
  panelClassName?: string
  dismissOnBackdrop?: boolean
  placement?: 'center' | 'right'
}

export function Dialog({
  open,
  onClose,
  label,
  children,
  panelClassName = '',
  dismissOnBackdrop = false,
  placement = 'center',
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)
  const returnFocus = useRef<HTMLElement | null>(null)
  if (open && !wasOpen.current && typeof document !== 'undefined') returnFocus.current = document.activeElement as HTMLElement | null
  wasOpen.current = open
  const isTopmost = () => {
    const native = document.querySelector('dialog[open]')
    if (native && !native.contains(panelRef.current)) return false
    return modalStack.at(-1) === panelRef.current
  }
  useClickOutside(panelRef, () => { if (dismissOnBackdrop && isTopmost()) onClose() }, open)

  useEffect(() => {
    if (!open) return
    const previous = returnFocus.current
    const panel = panelRef.current
    if (!modalStack.length) { originalOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' }
    if (panel) { modalStack.push(panel); if (panel.parentElement) panel.parentElement.style.zIndex = String(50 + modalStack.length * 2) }
    const focusInside = () => {
      if (!isTopmost()) return
      const field = panelRef.current?.querySelector<HTMLElement>('[autofocus], button:not(:disabled), input:not(:disabled):not([type="hidden"]), textarea:not(:disabled), select:not(:disabled), a[href]')
      ;(field ?? panelRef.current)?.focus()
    }
    if (!panelRef.current?.contains(document.activeElement)) focusInside()
    const protectFocus = () => { queueMicrotask(() => { if (isTopmost() && !panelRef.current?.contains(document.activeElement)) focusInside() }) }
    document.addEventListener('focusin', protectFocus)
    return () => {
      document.removeEventListener('focusin', protectFocus)
      const index = panel ? modalStack.indexOf(panel) : -1
      if (index >= 0) modalStack.splice(index, 1)
      if (!modalStack.length) document.body.style.overflow = originalOverflow
      if (previous?.isConnected && (document.activeElement === document.body || panel?.contains(document.activeElement))) previous.focus()
    }
  }, [open])

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
        tabIndex={-1}
        className={`absolute ${placement === 'right' ? 'inset-y-0 right-0' : 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'} ${panelClassName}`}
      >
        {children}
      </div>
    </div>
  )
}
