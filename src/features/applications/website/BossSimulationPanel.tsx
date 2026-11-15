'use client'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { BROWSER_TASK_LABELS, type BrowserRun } from '@/domain/browser-application'
import { encodeAttachment } from '../mail/lib/mail-attachment'
import { saveBrowserSimulation } from '../history/lib/browser-simulation-storage'
import type { BossDraft } from './lib/boss-workspace-storage'
import { bossRequest, type BossConnection } from './lib/boss-client'
import { describeBossImages } from './lib/boss-images'

const ACTIVE_KEY = 'boss-browser:simulation-id:v1'
export function BossSimulationPanel({ connection, drafts, images, onRunning, disabled = false }: { connection: BossConnection | null; drafts: BossDraft[]; images: File[]; onRunning: (running: boolean) => void; disabled?: boolean }) {
  const [run, setRun] = useState<BrowserRun | null>(null)
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [id, setId] = useState('')
  const attemptedId = useRef('')
  const running = pending || run?.state === 'running'
  useEffect(() => { const value = sessionStorage.getItem(ACTIVE_KEY); if (value) { attemptedId.current = value; setId(value) } }, [])
  useEffect(() => { onRunning(running); return () => onRunning(false) }, [running, onRunning])
  useEffect(() => {
    if (!connection || !id) return
    let active = true, timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try {
        const value = await bossRequest<BrowserRun>(connection, `/simulation/${id}`)
        if (!active) return
        setRun(value); setSaved(false)
        try { await saveBrowserSimulation(value); if (active) { setSaved(true); setError('') } } catch { if (active) setError('执行状态未能写入本机记录，稍后可重新读取；不要因此重复执行。') }
        if (active && value.state === 'running') timer = setTimeout(poll, 1000)
      } catch (failure) { if (active) setError(`${failure instanceof Error ? failure.message : '读取失败'}。可重新读取状态，不要新建任务重发。`) }
    }
    void poll()
    return () => { active = false; clearTimeout(timer) }
  }, [connection, id, refresh])
  const start = async () => {
    if (!connection || pending || disabled) return
    setPending(true); setError('')
    try {
      const metadata = await describeBossImages(images)
      const payload = await Promise.all(images.map(async (file, index) => ({ name: file.name, type: metadata[index].type, sha256: metadata[index].sha256, base64: await encodeAttachment(file) })))
      const nextId = attemptedId.current || crypto.randomUUID()
      attemptedId.current = nextId; sessionStorage.setItem(ACTIVE_KEY, nextId)
      const result = await bossRequest<BrowserRun>(connection, '/simulation', { id: nextId, jobs: drafts.map(({ url, company, title, greeting }) => ({ url, company, title, greeting })), images: payload })
      setRun(result); setId(nextId)
      await saveBrowserSimulation(result); setSaved(true)
    } catch (failure) { setError(failure instanceof Error ? failure.message : '模拟任务创建失败'); if (attemptedId.current) { setId(attemptedId.current); setRefresh(value => value + 1) } }
    finally { setPending(false) }
  }
  return <section className="border border-line p-4" aria-label="模拟投递执行"><h2 className="text-section font-medium">模拟执行</h2><p className="my-2 text-body text-text-secondary">在独立无界面测试浏览器中逐条发送招呼语和图片、读取回执。不使用你的 BOSS 登录，不联系招聘方。</p><div className="flex flex-wrap gap-3"><Button variant="secondary" disabled={disabled || !connection || pending || running || !!run || !drafts.length} onClick={() => void start()}>运行模拟测试</Button>{running && id && <Button variant="secondary" onClick={() => { if (connection) void bossRequest(connection, `/simulation/${id}/stop`, {}).catch(failure => setError(String(failure))) }}>完成当前步骤后暂停</Button>}{(run || id) && !running && <Button variant="link" onClick={() => { setRun(null); setId(''); attemptedId.current = ''; sessionStorage.removeItem(ACTIVE_KEY); setError('') }}>新建模拟测试</Button>}{error && id && <Button variant="link" onClick={() => { setRefresh(value => value + 1) }}>重新读取状态</Button>}</div>{error && <p role="alert" className="mt-3 text-body text-danger">{error}</p>}{run && <div className="mt-4 space-y-3"><p role="status" className="text-label">{run.state === 'running' ? '模拟任务执行中' : run.state === 'finished' ? saved ? '模拟测试结束，结果已写入投递记录的测试区' : '模拟测试结束，正在保存记录' : run.state === 'paused' ? '已暂停，请核对结果' : `模拟失败：${run.error ?? ''}`}</p>{run.tasks.map(task => <article key={task.url} className="border-t border-line pt-3"><p className="text-body">{task.company} · {task.title} · {BROWSER_TASK_LABELS[task.state]}</p><p className="mt-1 text-meta text-text-secondary">{task.steps.map(step => `${step.kind === 'greeting' ? '招呼语' : '图片'}：${step.state === 'verified' ? '回执已核对' : step.state === 'uncertain' || step.state === 'sending' ? '待核对' : '未执行'}`).join(' · ')}</p>{task.error && <p className="mt-1 text-body text-danger">{task.error}</p>}</article>)}</div>}</section>
}
