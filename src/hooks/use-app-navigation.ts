'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback } from 'react'
import type { Mode } from '@/application/types'

export type Phase = 'upload' | 'review' | 'workspace'

export function parseAppPath(pathname: string): { phase: Phase; mode: Mode } {
  if (pathname === '/applications') return { phase: 'workspace', mode: 'applications' }
  if (pathname === '/review') return { phase: 'review', mode: 'audit' }
  if (pathname === '/diagnosis') return { phase: 'workspace', mode: 'diagnosis' }
  if (pathname === '/interview') return { phase: 'workspace', mode: 'interview' }
  if (pathname === '/report') return { phase: 'workspace', mode: 'report' }
  if (pathname === '/knowledge') return { phase: 'workspace', mode: 'knowledge' }
  if (pathname === '/audit') return { phase: 'workspace', mode: 'audit' }
  return { phase: 'upload', mode: 'audit' }
}

export function buildAppPath(phase: Phase, mode: Mode = 'audit'): string {
  if (phase === 'review') return '/review'
  if (phase === 'workspace') return `/${mode}`
  return '/'
}

export function useAppNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { phase, mode } = parseAppPath(pathname)

  const push = useCallback(
    (newPhase: Phase, newMode?: Mode) => {
      router.push(buildAppPath(newPhase, newMode))
    },
    [router],
  )

  const replace = useCallback(
    (newPhase: Phase, newMode?: Mode) => {
      router.replace(buildAppPath(newPhase, newMode))
    },
    [router],
  )

  return { phase, mode, push, replace }
}
