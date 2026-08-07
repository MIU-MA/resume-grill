'use client'

import { useCallback, useRef, useState } from 'react'
import { useClickOutside } from '@/hooks/use-click-outside'

/**
 * 下拉菜单的开关状态 + 点击外部自动关闭。
 * ref 需要绑定到菜单容器上。
 */
export function useDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useClickOutside(ref, useCallback(() => setOpen(false), []), open)

  const toggle = useCallback(() => setOpen((o) => !o), [])
  const close = useCallback(() => setOpen(false), [])

  return { open, toggle, close, ref }
}
