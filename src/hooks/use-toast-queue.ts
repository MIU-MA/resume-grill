'use client'

import { useCallback, useEffect, useState, type SetStateAction } from 'react'

export type ToastTone = 'success' | 'info' | 'error'
type Notice = { id: number; message: string; duration: number; tone: ToastTone }
export function useToastQueue() {
  const [queue, setQueue] = useState<Notice[]>([])
  const current = queue[0]
  const dismiss = useCallback(() => setQueue(items => items.slice(1)), [])
  const showToast = useCallback((message: string, duration = 3200, tone?: ToastTone) => {
    const resolvedTone = tone ?? (/失败|未能|错误|丢失|无法/.test(message) ? 'error' : 'info')
    setQueue(items => [...items, { id: (items.at(-1)?.id ?? Date.now()) + 1, message, duration: resolvedTone === 'error' ? 0 : duration, tone: resolvedTone }])
  }, [])
  useEffect(() => {
    if (!current?.duration) return
    const timer = window.setTimeout(dismiss, current.duration)
    return () => window.clearTimeout(timer)
  }, [current?.id, current?.duration, dismiss])
  const setToast = (value: SetStateAction<string>) => {
    const message = typeof value === 'function' ? value(current?.message ?? '') : value
    if (!message) dismiss(); else showToast(message)
  }
  return { toast: current?.message ?? '', toastTone: current?.tone ?? 'info', setToast, showToast }
}
