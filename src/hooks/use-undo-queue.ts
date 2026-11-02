'use client'

import { useEffect, useRef, useState } from 'react'

type UndoItem = {
  id: string; label: string; restore: () => void | Promise<void>
  expires: number; pending?: boolean; error?: string
}

export function useUndoQueue(duration = 8000) {
  const [items, setItems] = useState<UndoItem[]>([])
  const restoring = useRef(new Set<string>())
  useEffect(() => {
    const waiting = items.filter(item => !item.pending)
    if (!waiting.length) return
    const timer = setTimeout(() => setItems(current => current.filter(item => item.pending || item.expires > Date.now())), Math.max(0, Math.min(...waiting.map(item => item.expires)) - Date.now()))
    return () => clearTimeout(timer)
  }, [items])
  const add = (label: string, restore: UndoItem['restore']) => {
    setItems(current => [...current, { id: crypto.randomUUID(), label, restore, expires: Date.now() + duration }])
  }
  const undo = async (id: string) => {
    const item = items.find(item => item.id === id)
    if (!item || item.expires <= Date.now() || restoring.current.has(id)) return
    restoring.current.add(id)
    setItems(current => current.map(item => item.id === id ? { ...item, pending: true, error: undefined } : item))
    try {
      await item.restore()
      setItems(current => current.filter(item => item.id !== id))
    } catch {
      setItems(current => current.map(item => item.id === id ? { ...item, pending: false, error: '撤销未完成，请重试。', expires: Date.now() + duration } : item))
    } finally { restoring.current.delete(id) }
  }
  const dismiss = (id: string) => setItems(current => current.filter(item => item.id !== id || item.pending))
  return { items, add, undo, dismiss }
}
