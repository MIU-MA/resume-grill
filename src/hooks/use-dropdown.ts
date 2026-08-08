'use client'

import { useCallback, useRef, useState } from 'react'
import { useClickOutside } from '@/hooks/use-click-outside'

export function useDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(ref, useCallback(() => setOpen(false), []), open)

  const toggle = useCallback(() => setOpen((o) => !o), [])
  const close = useCallback(() => setOpen(false), [])

  return { open, toggle, close, ref }
}
