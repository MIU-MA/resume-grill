'use client'
import { useEffect } from 'react'
export function ThemePreference() {
  useEffect(() => { try { document.documentElement.classList.toggle('dark', localStorage.getItem('resume-grill:theme') === 'dark') } catch { /* Use the default light theme. */ } }, [])
  return null
}
