'use client'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { BROWSER_TASK_LABELS } from '@/domain/browser-application'
import { saveBrowserSimulation } from '../history/lib/browser-simulation-storage'
import type { BossDraft } from './lib/boss-workspace-storage'
import { bossRequest, type BossConnection } from './lib/boss-client'
import { encodeBossImages } from './lib/boss-images'
import { useBossRun } from './hooks/use-boss-run'

const ACTIVE_KEY = 'boss-browser:simulation-id:v1'
export function BossSimulationPanel({ connection, drafts, images, onRunning, disabled = false }: { connection: BossConnection | null; drafts: BossDraft[]; images: File[]; onRunning: (running: boolean) => void; disabled?: boolean }) {
  const [pending, setPending] = useState(false)
  const [commandError, setCommandError] = useState('')
  const lock = useRef(false)
  const tracker = useBossRun(connection, ACTIVE_KEY, '/simulation', saveBrowserSimulation)
  const { id, run, saved } = tracker
  const error = tracker.error || commandError
  const running = pending || run?.state === 'running'
  useEffect(() => { onRunning(running); return () => onRunning(false) }, [running, onRunning])

  const start = async () => {
    if (!connection || lock.current || id || disabled) return
    lock.current = true; setPending(true); setCommandError('')
    try {
      const imagesPayload = await encodeBossImages(images)
      const nextId = crypto.randomUUID()
      const jobs = drafts.map(({ url, company, title, greeting }) => ({ url, company, title, greeting }))
      await tracker.submit(nextId, () => bossRequest(connection, '/simulation', { id: nextId, jobs, images: imagesPayload }))
    } catch (failure) {
      setCommandError(failure instanceof Error ? failure.message : '模拟任务创建失败')
    } finally {
      lock.current = false; setPending(false)
    }
  }
  return <section className="border border-line p-4" aria-label="模拟投递执行"><h2 className="text-section font-medium">模拟执行</h2><p className="my-2 text-body text-text-secondary">在独立无界面测试浏览器中逐条发送招呼语和图片、读取回执。不使用你的 BOSS 登录，不联系招聘方。</p><div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={disabled || !connection || pending || running || !!id || !drafts.length} onClick={() => void start()}>运行模拟测试</Button>{running && id && <Button variant="secondary" onClick={() => { if (connection) void bossRequest(connection, `/simulation/${id}/stop`, {}).catch(failure => setCommandError(String(failure))) }}>完成当前步骤后暂停</Button>}{(run || id) && !running && <Button variant="link" onClick={() => { tracker.open(''); setCommandError('') }}>新建模拟测试</Button>}{error && id && <Button variant="link" onClick={tracker.reload}>重新读取状态</Button>}</div>{error && <p role="alert" className="mt-3 text-body text-danger">{error}</p>}{run && <div className="mt-4 space-y-3"><p role="status" className="text-label">{run.state === 'running' ? '模拟任务执行中' : run.state === 'finished' ? saved ? '模拟测试结束，结果已写入投递记录的测试区' : '模拟测试结束，正在保存记录' : run.state === 'paused' ? '已暂停，请核对结果' : `模拟失败：${run.error ?? ''}`}</p>{run.tasks.map(task => <article key={task.url} className="border-t border-line pt-3"><p className="text-body">{task.company} · {task.title} · {BROWSER_TASK_LABELS[task.state]}</p><p className="mt-1 text-meta text-text-secondary">{task.steps.map(step => `${step.kind === 'greeting' ? '招呼语' : '图片'}：${step.state === 'verified' ? '回执已核对' : step.state === 'uncertain' || step.state === 'sending' ? '待核对' : '未执行'}`).join(' · ')}</p>{task.error && <p className="mt-1 text-body text-danger">{task.error}</p>}</article>)}</div>}</section>
}
