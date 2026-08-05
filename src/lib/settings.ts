'use client'

export type LlmSettings = {
  baseUrl: string
  apiKey: string
  model: string
}

const STORAGE_KEY = 'resume-grill-llm'
const TEST_RESULT_KEY = 'resume-grill-llm:test'

export type TestResult = 'ok' | 'fail'

export function getLlmSettings(): LlmSettings | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LlmSettings>
    if (parsed.baseUrl && parsed.apiKey && parsed.model) {
      return { baseUrl: parsed.baseUrl, apiKey: parsed.apiKey, model: parsed.model }
    }
    return null
  } catch {
    return null
  }
}

export function setLlmSettings(settings: LlmSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

export function clearLlmSettings() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function hasClientLlm(): boolean {
  return getLlmSettings() !== null
}

export function getTestResult(): TestResult | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(TEST_RESULT_KEY)
    return v === 'ok' || v === 'fail' ? v : null
  } catch {
    return null
  }
}

export function setTestResult(r: TestResult) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TEST_RESULT_KEY, r)
  window.dispatchEvent(new CustomEvent('llm-test-result'))
}

export function clearTestResult() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(TEST_RESULT_KEY)
  window.dispatchEvent(new CustomEvent('llm-test-result'))
}
