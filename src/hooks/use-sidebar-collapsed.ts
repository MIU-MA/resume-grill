'use client'

import { useCallback, useEffect, useState } from 'react'

const KEY = 'resume-grill:nav-collapsed'

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    try { setCollapsed(window.localStorage.getItem(KEY) === '1') } catch { /* Keep the default if storage is unavailable. */ }
  }, [])
  const toggle = useCallback(() => {
    setCollapsed(current => {
      const next = !current
      try { window.localStorage.setItem(KEY, next ? '1' : '0') } catch { /* Still usable for this visit. */ }
      return next
    })
  }, [])
  return [collapsed, toggle] as const
}
