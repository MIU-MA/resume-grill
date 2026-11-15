'use client'
import { useEffect, useState } from 'react'
import type { BrowserRun } from '@/domain/browser-application'
import { loadBossBatches } from './lib/boss-batch-storage'
export function BossBatchHistory() {
  const [runs, setRuns] = useState<BrowserRun[]>([]), [error, setError] = useState('')
  useEffect(() => { let active = true; void loadBossBatches().then(value => { if (active) setRuns(value) }).catch(() => { if (active) setError('BOSS 批次记录读取失败') }); return () => { active = false } }, [])
  if (!runs.length && !error) return null
  return <details className="flex-none border-b border-line px-4 py-3 text-label"><summary className="cursor-pointer">BOSS 执行批次 · {runs.length} 批</summary><div className="mt-3 max-h-72 space-y-3 overflow-y-auto">{error && <p role="alert">{error}</p>}{runs.map(run => <article key={run.id}><p className="text-meta text-text-secondary">{new Date(run.createdAt).toLocaleString()} · {run.state === 'running' ? '执行中' : run.state === 'finished' ? '已结束' : run.state === 'paused' ? '已暂停' : '失败'}</p>{run.tasks.map(task => <p key={task.url} className="mt-1 text-body">{task.company} · {task.title} · {task.state === 'verified' ? '已投递并核验' : task.state === 'uncertain' ? '待核对，不自动重发' : task.state === 'failed' ? '执行失败' : '尚未完成'}{task.error ? ` · ${task.error}` : ''}</p>)}</article>)}</div></details>
}
