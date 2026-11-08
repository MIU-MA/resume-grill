'use client'
import { useEffect, useRef, useState } from 'react'
import type { KnowledgeItem, KnowledgeItemPatch } from '@/domain/knowledge'
import { scheduleReview } from '@/domain/review-schedule'
import { practiceRequest } from '@/features/interview/lib/practice-request'
import { useSessionState } from '@/hooks/use-session-state'

export function KnowledgeStudy({ items, onUpdate }: { items: KnowledgeItem[]; onUpdate: (id: string, patch: KnowledgeItemPatch) => void }) {
  const [ids, setIds] = useState<string[]>([])
  const [session, setSession] = useSessionState<{ queue: string[]; deadline: number } | null>('knowledge-study-session', null, (value): value is { queue: string[]; deadline: number } | null => value === null || (typeof value === 'object' && Array.isArray((value as { queue?: unknown }).queue) && (value as { queue: unknown[] }).queue.every(id => typeof id === 'string') && typeof (value as { deadline?: unknown }).deadline === 'number'))
  const [now, setNow] = useState(Date.now())
  const [answer, setAnswer] = useSessionState(`knowledge-study-answer:${session?.queue.find(id => items.some(item => item.id === id)) ?? 'setup'}`, '', (value): value is string => typeof value === 'string')
  const [revealed, setRevealed] = useState(false), [feedback, setFeedback] = useState(''), [busy, setBusy] = useState(false)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => { if (!session) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [session])
  const queue = session?.queue.filter(id => items.some(item => item.id === id)) ?? []
  const item = items.find(item => item.id === queue[0])
  const expired = !!session?.deadline && now >= session.deadline
  const due = items.filter(item => (item.status !== 'mastered' || item.review) && (item.review?.dueAt ?? 0) <= now)
  const start = (timed: boolean) => {
    const selected = ids.length ? ids : due.map(item => item.id)
    if (!selected.length) { setFeedback('先选择要复习的内容。'); return }
    setSession({ queue: selected.slice(0, 20), deadline: timed ? Date.now() + 300000 : 0 }); setNow(Date.now()); setAnswer(''); setRevealed(false); setFeedback('')
  }
  const stop = () => { request.current?.abort(); setBusy(false); setSession(null); setFeedback('本次复习已结束，已评分的记录已保存。') }
  const rate = (quality: number) => {
    if (!item || !session || busy) return
    onUpdate(item.id, { review: scheduleReview(item.review, quality) })
    setSession({ ...session, queue: [...queue.slice(1), ...(quality < 4 ? [item.id] : [])] })
    setAnswer(''); setRevealed(false); setFeedback('')
  }
  return <section className="border border-line bg-white p-4 text-body" aria-label="闪卡自测">
    <div className="flex flex-wrap items-center gap-3"><h3 className="mr-auto text-section font-semibold">闪卡自测</h3><span className="text-meta text-text-tertiary">今日到期 {due.length} 张</span>{session && <button onClick={stop}>结束复习</button>}</div>
    {!session ? <><div className="my-3 max-h-48 space-y-2 overflow-auto">{items.map(card => <label key={card.id} className="flex items-start gap-2"><input type="checkbox" checked={ids.includes(card.id)} onChange={event => setIds(current => event.target.checked ? [...current, card.id] : current.filter(id => id !== card.id))} /><span>{card.title}<span className="ml-2 text-meta text-text-tertiary">{card.review ? `下次 ${new Date(card.review.dueAt).toLocaleDateString()}` : '尚未自测'}{card.verification ? ` · 模型检验 ${card.verification.score} 分` : ''}</span></span></label>)}</div><div className="flex gap-4"><button onClick={() => start(false)}>开始闪卡复习</button><button onClick={() => start(true)}>5 分钟盲点突击</button></div></> : expired || !item ? <p role="status">{expired ? '5 分钟到了。' : '本次内容已复习完。'}复习记录已保留，可结束后重新选择。</p> : <>
      <p role="status" className="my-3 text-meta">本组剩余 {queue.length} 张{session.deadline ? ` · 剩余 ${Math.max(0, Math.ceil((session.deadline - now) / 1000))} 秒` : ''}</p>
      <p className="font-medium">{item.question || `请解释：${item.title}，并说明一个做法或适用条件。`}</p>
      <textarea aria-label="自测回答" className="mail-input my-3 min-h-28" maxLength={12000} value={answer} disabled={busy} onChange={event => setAnswer(event.target.value)} />
      <div className="flex gap-4"><button disabled={busy} onClick={() => setRevealed(true)}>查看参考内容</button><button disabled={busy || !answer.trim()} onClick={async () => {
        const abort = new AbortController(); request.current = abort; setBusy(true); setFeedback('')
        try {
          const result = await practiceRequest<{ score: number; feedback: string }>('card', answer, JSON.stringify({ question: item.question || item.title, reference: [item.detail, item.note] }), abort.signal)
          if (!abort.signal.aborted) { setFeedback(`${result.score} 分：${result.feedback}`); onUpdate(item.id, { verification: { at: Date.now(), ...result } }) }
        } catch (cause) { if (!abort.signal.aborted) setFeedback(cause instanceof Error ? cause.message : '检验失败。') }
        finally { if (!abort.signal.aborted) setBusy(false) }
      }}>{busy ? '正在检验…' : '提交给模型检验'}</button></div>
      {revealed && <p className="my-3 whitespace-pre-wrap border-l-2 border-line pl-3">{[item.detail, item.note].filter(Boolean).join('\n\n') || '这张卡还没有参考内容，可以自行补充或提交回答检验。'}</p>}
      {revealed && <div className="mt-4 flex flex-wrap gap-4" aria-label="自评掌握情况">{([[0, '没想起来'], [3, '很吃力'], [4, '基本答对'], [5, '清楚答对']] as const).map(([quality, label]) => <button key={quality} disabled={busy} onClick={() => rate(quality)}>{label}</button>)}</div>}
    </>}
    {feedback && <p role="status" className="mt-3 whitespace-pre-wrap">{feedback}</p>}
    <p className="mt-3 text-meta text-text-tertiary">自评安排下次复习；模型检验单独记录。只有点击检验才会调用模型。</p>
  </section>
}
