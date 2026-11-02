import { resumeContentKey } from '@/lib/storage'
import type { ResumeClaim } from '@/domain/resume-schema'

export function interviewInputKey(scope: string, claim: ResumeClaim, version: number, count: number, question: string) {
  return `resume-grill:answer:${scope}:${claim.id}:${resumeContentKey(claim.content)}:${version}:${count}:${resumeContentKey(question)}`
}
export function readInterviewInput(key: string) {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(key) ?? 'null')
    if (typeof value?.answer === 'string' && typeof value?.annotation === 'string') return value as { answer: string; annotation: string }
  } catch { /* Session storage may be disabled. */ }
  return { answer: '', annotation: '' }
}
export function writeInterviewInput(key: string, value: { answer: string; annotation: string }) {
  try {
    if (value.answer || value.annotation) window.sessionStorage.setItem(key, JSON.stringify(value))
    else window.sessionStorage.removeItem(key)
    return true
  } catch { return false }
}
