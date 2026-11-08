import { getLlmSettings } from '@/lib/settings'
export async function practiceRequest<T>(action: 'card' | 'interview', text: string, context: string, signal: AbortSignal): Promise<T> {
  const response = await fetch('/api/practice-review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, text, context, llm: getLlmSettings() ?? undefined }), signal: AbortSignal.any([signal, AbortSignal.timeout(100000)]) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '请求失败，请重试。')
  return data as T
}
