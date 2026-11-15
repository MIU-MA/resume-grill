'use client'
import { useEffect, useState } from 'react'
import { BROWSER_TASK_LABELS, type BrowserRun } from '@/domain/browser-application'
import { loadBrowserSimulations } from './lib/browser-simulation-storage'

export function BrowserSimulationHistory() {
  const [runs, setRuns] = useState<BrowserRun[]>([])
  const [error, setError] = useState('')
  useEffect(() => { let active = true; void loadBrowserSimulations().then(value => { if (active) setRuns(value) }).catch(() => { if (active) setError('模拟记录读取失败') }); return () => { active = false } }, [])
  if (!runs.length && !error) return null
  return <details className="flex-none border-b border-line px-4 py-3 text-label"><summary className="cursor-pointer">浏览器模拟测试 · {runs.length} 批（不计入投递）</summary><div className="mt-3 max-h-72 space-y-3 overflow-y-auto">{error && <p role="alert">{error}</p>}{runs.map(run => <section key={run.id}><p className="text-meta text-text-secondary">{new Date(run.createdAt).toLocaleString()} · {run.state === 'finished' ? '测试结束' : run.state === 'running' ? '执行中，回到 BOSS 页面查看' : run.state === 'paused' ? '已暂停' : '执行失败'}</p>{run.tasks.map(task => <p key={task.url} className="mt-1 text-body">{task.company} · {task.title} · {BROWSER_TASK_LABELS[task.state]}{task.error ? ` · ${task.error}` : ''}</p>)}</section>)}</div></details>
}
