'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useCallback } from 'react'
import type { Mode } from '@/types'

export type Phase = 'upload' | 'review' | 'workspace'

export function useAppNavigation() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const phase = (searchParams.get('phase') as Phase) || 'upload'
  const mode = (searchParams.get('tab') as Mode) || 'audit'

  const push = useCallback(
    (newPhase: Phase, newMode?: Mode) => {
      const params = new URLSearchParams()
      params.set('phase', newPhase)
      if (newMode) params.set('tab', newMode)
      router.push(`/?${params.toString()}`)
    },
    [router],
  )

  const replace = useCallback(
    (newPhase: Phase, newMode?: Mode) => {
      const params = new URLSearchParams()
      params.set('phase', newPhase)
      if (newMode) params.set('tab', newMode)
      router.replace(`/?${params.toString()}`)
    },
    [router],
  )

  return { phase, mode, push, replace }
}
