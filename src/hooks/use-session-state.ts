'use client'

import { useCallback, useEffect, useSyncExternalStore, type SetStateAction } from 'react'

const listeners = new Set<() => void>()
const fallback = new Map<string, string>()
const serverSnapshot = () => null
const write = (key: string, text: string) => {
  try { window.sessionStorage.setItem(key, text); fallback.delete(key) } catch { fallback.set(key, text) }
  for (const notify of listeners) notify()
}

/** Small UI preferences only. Storage can be disabled without breaking the page. */
export function useSessionState<T>(key: string, initial: T, valid: (value: unknown) => value is T) {
  const storageKey = `resume-grill:ui:${key}`
  const read = useCallback(() => {
    if (fallback.has(storageKey)) return fallback.get(storageKey)!
    try { return window.sessionStorage.getItem(storageKey) } catch { return null }
  }, [storageKey])
  const subscribe = useCallback((notify: () => void) => {
    listeners.add(notify)
    window.addEventListener('storage', notify)
    return () => { listeners.delete(notify); window.removeEventListener('storage', notify) }
  }, [])
  const raw = useSyncExternalStore(subscribe, read, serverSnapshot)
  const parse = (text: string | null): T => {
    try { const value: unknown = JSON.parse(text ?? 'null'); return valid(value) ? value : initial } catch { return initial }
  }
  const setValue = (action: SetStateAction<T>) => {
    const previous = parse(read())
    const next = typeof action === 'function' ? (action as (value: T) => T)(previous) : action
    const text = JSON.stringify(next)
    if (text !== read()) write(storageKey, text)
  }
  const seed = JSON.stringify(initial)
  useEffect(() => { if (read() === null) write(storageKey, seed) }, [read, storageKey, seed])
  return [parse(raw), setValue] as const
}

export const stringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string')
