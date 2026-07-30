'use client'

import { useEffect, useState } from 'react'
import { hasClientLlm } from '@/lib/settings'

export type LlmMode = { label: string; cls: 'local' | 'env' | 'mock' }

export function useLlmStatus() {
  const [envConfigured, setEnvConfigured] = useState(false)
  const [clientConfigured, setClientConfigured] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    fetch('/api/status').then((r) => r.json()).then((d: { envConfigured: boolean }) => setEnvConfigured(d.envConfigured)).catch(() => undefined)
    setClientConfigured(hasClientLlm())
    setMounted(true)
  }, [])

  const refresh = () => setClientConfigured(hasClientLlm())

  const mode: LlmMode | null = !mounted ? null
    : clientConfigured ? { label: '本地 Key', cls: 'local' }
    : envConfigured ? { label: '服务端 Key', cls: 'env' }
    : { label: '规则示例', cls: 'mock' }

  return { envConfigured, clientConfigured, mounted, mode, refresh }
}
