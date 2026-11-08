'use client'
import { useEffect, useRef, useState } from 'react'
import { get, update } from 'idb-keyval'
import type { KnowledgeItemInput } from '@/domain/knowledge'
import { getLlmSettings } from '@/lib/settings'
import { practiceRequest } from './lib/practice-request'
type Review = { summary: string; gaps: Array<{ topic: string; explanation: string; question: string; evidence: string; kind: 'knowledge' | 'expression' | 'fact' }> }
type Record = { id: string; at: number; text: string; jd: string; result: Review }
const KEY = 'resume-grill:external-interviews:v1'
export function ExternalInterviewReview({ onAdd }: { onAdd: (input: KnowledgeItemInput) => void }) {
  const [text, setText] = useState(''), [jd, setJd] = useState(''), [model, setModel] = useState('whisper-1')
  const [records, setRecords] = useState<Record[]>([]), [result, setResult] = useState<Review | null>(null)
  const [selected, setSelected] = useState<number[]>([]), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => { let active = true; void get<Record[]>(KEY).then(value => { if (active) setRecords(value ?? []) }).catch(() => setMessage('旧复盘记录未能读取。')); return () => { active = false; request.current?.abort() } }, [])
  const changeText = (value: string) => { setText(value); setResult(null); setSelected([]) }
  return <section className="space-y-3 border border-line bg-white p-4 text-body" aria-label="真实面试复盘">
    <h3 className="text-section font-semibold">真实面试复盘</h3>
    <label className="mail-label">岗位要求（选填）<textarea className="mail-input" maxLength={12000} value={jd} disabled={busy} onChange={event => { setJd(event.target.value); setResult(null) }} /></label>
    <label className="mail-label">面试转写或笔记<textarea className="mail-input min-h-36" maxLength={20000} value={text} disabled={busy} onChange={event => changeText(event.target.value)} /></label>
    <label className="mail-label">导入文字文件<input type="file" accept=".txt,.md" disabled={busy} onChange={async event => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (file.size > 200000) { setMessage('文字文件过大，请精简到 20000 字以内。'); return }; const content = await file.text(); if (content.length > 20000) setMessage('文字超过 20000 字，请先精简。'); else changeText(content) }} /></label>
    <details><summary>从录音转写</summary><p className="my-2 text-meta">选择文件后会发送到已配置的模型服务，可能产生转写费用。服务需支持音频转写，可自行填写转写模型。</p><label className="mail-label">转写模型<input className="mail-input" value={model} disabled={busy} onChange={event => setModel(event.target.value)} /></label><input type="file" aria-label="导入面试录音" accept=".mp3,.m4a,.mp4,.wav,.webm,.ogg" disabled={busy} onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = ''; if (!file) return
      if (file.size > 24 * 1024 * 1024) { setMessage('录音不能超过 24 MB。'); return }
      const abort = new AbortController(); request.current = abort; setBusy(true); setMessage('正在转写录音…')
      try {
        const data = new FormData(); data.set('audio', file); data.set('model', model); data.set('llm', JSON.stringify(getLlmSettings()))
        const response = await fetch('/api/transcribe', { method: 'POST', body: data, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(110000)]) })
        const result = await response.json(); if (!response.ok) throw new Error(result.error)
        if (!abort.signal.aborted) { changeText(result.text); setMessage('转写完成，请先核对文字再复盘。') }
      } catch (cause) { if (!abort.signal.aborted) setMessage(cause instanceof Error ? cause.message : '转写失败。') }
      finally { if (!abort.signal.aborted) setBusy(false) }
    }} /></details>
    <button disabled={busy || !text.trim()} onClick={async () => {
      const abort = new AbortController(); request.current = abort; setBusy(true); setMessage('')
      try {
        const review = result ?? await practiceRequest<Review>('interview', text, jd, abort.signal)
        if (abort.signal.aborted) return
        setResult(review); setSelected(review.gaps.map((_, index) => index))
        const record = { id: crypto.randomUUID(), at: Date.now(), text, jd, result: review }
        await update<Record[]>(KEY, previous => [record, ...(previous ?? [])].slice(0, 30))
        setRecords(previous => [record, ...previous].slice(0, 30)); setMessage('复盘已保存在当前浏览器。')
      } catch (cause) { if (!abort.signal.aborted) setMessage(cause instanceof Error ? cause.message : '复盘失败。') }
      finally { if (!abort.signal.aborted) setBusy(false) }
    }}>{busy ? '处理中…' : '复盘并保存'}</button>
    {result && <div className="space-y-3 border-t border-line pt-3"><p className="whitespace-pre-wrap">{result.summary}</p>{result.gaps.map((gap, index) => <label key={index} className="flex items-start gap-2"><input type="checkbox" checked={selected.includes(index)} onChange={event => setSelected(previous => event.target.checked ? [...previous, index] : previous.filter(value => value !== index))} /><span><strong>{{ knowledge: '知识问题', expression: '表达问题', fact: '待核实事实' }[gap.kind]} · {gap.topic}</strong><span className="block">{gap.explanation}</span><q className="block text-text-tertiary">{gap.evidence}</q></span></label>)}<button disabled={!selected.length} onClick={() => { for (const index of selected) { const gap = result.gaps[index]; onAdd({ title: gap.topic, detail: gap.explanation, question: gap.question, note: `面试原话：${gap.evidence}` }) }; setSelected([]); setMessage('已加入待复习。') }}>将勾选内容加入待复习</button></div>}
    {records.length > 0 && <label className="mail-label">查看已保存的复盘<select value="" disabled={busy} onChange={event => { const record = records.find(record => record.id === event.target.value); if (record) { setText(record.text); setJd(record.jd); setResult(record.result); setSelected([]) } }}><option value="">选择记录</option>{records.map(record => <option key={record.id} value={record.id}>{new Date(record.at).toLocaleString()} · {record.text.slice(0, 25)}</option>)}</select></label>}
    {message && <p role="status">{message}</p>}
  </section>
}
