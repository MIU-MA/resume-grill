'use client'

import { useEffect, useState } from 'react'
import { getTestResult, hasClientLlm, type TestResult } from '@/lib/settings'

export type LlmMode = { label: string; cls: 'local' | 'env' | 'mock'; testResult?: TestResult }

export function useLlmStatus() {
  const [envConfigured, setEnvConfigured] = useState(false)
  const [clientConfigured, setClientConfigured] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  useEffect(() => {
    fetch('/api/status').then((r) => r.json()).then((d: { envConfigured: boolean }) => setEnvConfigured(d.envConfigured)).catch(() => undefined)
    setClientConfigured(hasClientLlm())
    setTestResult(getTestResult())
    setMounted(true)
  }, [])

  useEffect(() => {
    const handler = () => setTestResult(getTestResult())
    window.addEventListener('llm-test-result', handler)
    return () => window.removeEventListener('llm-test-result', handler)
  }, [])

  const refresh = () => setClientConfigured(hasClientLlm())

  const mode: LlmMode | null = !mounted ? null
    : {
        label: clientConfigured ? '本地 Key' : envConfigured ? '服务端 Key' : '规则示例',
        cls: clientConfigured ? 'local' : envConfigured ? 'env' : 'mock',
        testResult: testResult ?? undefined,
      }

  return { envConfigured, clientConfigured, mounted, mode, refresh }
}
