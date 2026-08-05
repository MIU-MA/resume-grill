'use client'

export type LlmSettings = {
  baseUrl: string
  apiKey: string
  model: string
}

const STORAGE_KEY = 'resume-grill-llm'

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
