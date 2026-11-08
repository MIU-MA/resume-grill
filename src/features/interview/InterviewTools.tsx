'use client'
import { useEffect, useState } from 'react'
import { useSessionState } from '@/hooks/use-session-state'
import { answerStructure } from '@/domain/answer-structure'
export function InterviewTools({ scope, answer }: { scope: string; answer: string }) {
  const [started, setStarted] = useSessionState(`interview-clock:${scope}`, 0, (value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { if (!started) setStarted(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [scope, started]) // eslint-disable-line react-hooks/exhaustive-deps
  const seconds = started ? Math.max(0, Math.floor((now - started) / 1000)) : 0
  return <div className="flex flex-wrap gap-3 text-meta text-text-tertiary"><span className="tabular-nums">本题经过 {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>{answerStructure(answer).map(part => <span key={part.label}>{part.label} · {part.mentioned ? '可能已提及' : '可检查'}</span>)}<span>仅作结构提醒，不参与评分。</span></div>
}
