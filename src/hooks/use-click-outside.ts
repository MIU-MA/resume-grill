'use client'

import { useEffect, type RefObject } from 'react'

/**
 * 点击 ref 指向元素外部时触发 onOutside（用于关闭下拉/浮层）。
 * enabled 为 false 时不监听，避免在关闭态白挂事件。
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onOutside: (e: MouseEvent) => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside(e)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onOutside, enabled])
}
