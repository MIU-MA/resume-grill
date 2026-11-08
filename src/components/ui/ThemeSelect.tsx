'use client'
import { useEffect, useState } from 'react'
export function ThemeSelect() {
  const [dark, setDark] = useState(false)
  useEffect(() => { try { const enabled = localStorage.getItem('resume-grill:theme') === 'dark'; setDark(enabled); document.documentElement.classList.toggle('dark', enabled) } catch { /* Theme storage is optional. */ } }, [])
  return <button className="px-2 py-1 text-label" aria-pressed={dark} onClick={() => { const next = !dark; setDark(next); document.documentElement.classList.toggle('dark', next); try { localStorage.setItem('resume-grill:theme', next ? 'dark' : 'light') } catch { /* Keep the active theme. */ } }}>{dark ? '切换浅色' : '切换深色'}</button>
}
