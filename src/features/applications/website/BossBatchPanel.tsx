'use client'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { BossBatchPreview, BrowserRun } from '@/domain/browser-application'
import type { BossDraft } from './lib/boss-workspace-storage'
import { bossRequest, type BossConnection } from './lib/boss-client'
import { describeBossImages } from './lib/boss-images'
import { encodeAttachment } from '../mail/lib/mail-attachment'
import { saveBossBatch } from '../history/lib/boss-batch-storage'
const ACTIVE = 'boss-browser:live-batch:v1'
export function BossBatchPanel({ connection, connected, drafts, images, onRunning, disabled = false }: { connection: BossConnection | null; connected: boolean; drafts: BossDraft[]; images: File[]; onRunning: (busy: boolean) => void; disabled?: boolean }) {
  const [preview, setPreview] = useState<BossBatchPreview | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [run, setRun] = useState<BrowserRun | null>(null)
  const [runId, setRunId] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const version = useRef(0), lock = useRef(false)
  const running = run?.state === 'running'
  useEffect(() => { setRunId(sessionStorage.getItem(ACTIVE) ?? '') }, [])
  useEffect(() => { const current = ++version.current; setPreview(null); setConfirmed(false); return () => { version.current = current + 1 } }, [drafts, images, connection])
  useEffect(() => { onRunning(pending || running); return () => onRunning(false) }, [pending, running, onRunning])
  useEffect(() => {
    if (!preview) return
    const timer = setTimeout(() => { setPreview(null); setConfirmed(false) }, Math.max(0, preview.expiresAt - Date.now()))
    return () => clearTimeout(timer)
  }, [preview])
  useEffect(() => {
    if (!connection || !runId) return
    let active = true, timer: ReturnType<typeof setTimeout>
    const read = async () => {
      try {
        const value = await bossRequest<BrowserRun>(connection, `/boss-batch/${runId}`)
        if (!active) return
        setRun(value); setSaved(false)
        try { await saveBossBatch(value); if (active) { setSaved(true); setError('') } } catch { if (active) setError('批次结果尚未写入本机投递记录。请重新读取状态，不要重新发送。') }
        if (active && value.state === 'running') timer = setTimeout(read, 1000)
      } catch (failure) { if (active) setError(`${failure instanceof Error ? failure.message : '读取失败'}。请重新读取状态，不要重复执行。`) }
    }
    void read()
    return () => { active = false; clearTimeout(timer) }
  }, [connection, runId, refresh])
  const work = async (action: () => Promise<void>) => {
    if (lock.current || !connection) return
    lock.current = true; setPending(true); setError('')
    try { await action() } catch (failure) { setError(failure instanceof Error ? failure.message : '批次操作失败') }
    finally { lock.current = false; setPending(false) }
  }
  const prepare = () => work(async () => {
    if (!connection) return
    const current = version.current
    const metadata = await describeBossImages(images)
    const payload = await Promise.all(images.map(async (file, index) => ({ name: file.name, type: metadata[index].type, sha256: metadata[index].sha256, base64: await encodeAttachment(file) })))
    const value = await bossRequest<BossBatchPreview>(connection, '/boss-batch/preview', { id: crypto.randomUUID(), jobs: drafts.map(({ url, company, title, greeting }) => ({ url, company, title, greeting })), images: payload })
    if (version.current === current) { setPreview(value); setConfirmed(false) }
  })
  const start = () => work(async () => {
    if (!connection || !preview || !confirmed) return
    sessionStorage.setItem(ACTIVE, preview.batchId)
    const id = preview.batchId
    try {
      const value = await bossRequest<BrowserRun>(connection, '/boss-batch/confirm', { id: preview.id, confirmed: true, defaultGreetingAccepted: true })
      setRun(value); setRunId(id); setPreview(null); setConfirmed(false)
      await saveBossBatch(value); setSaved(true)
    } catch (failure) { setRunId(id); setRefresh(value => value + 1); throw failure }
  })
  return <section className="space-y-4 border border-line p-4" aria-label="BOSS 批量投递">
    <div><h2 className="text-section font-semibold">批量投递</h2><p className="mt-2 text-body text-text-secondary">核对整批后，自动逐个打开岗位、建立沟通、发送招呼语和已选图片。遇到验证、沟通限制、付费提示或不明确的结果会暂停。</p></div>
    {!run && <Button disabled={disabled || !!runId || !connection || !connected || pending || !drafts.length || drafts.length > 10} onClick={() => void prepare()}>核对本批投递（{drafts.length} 个岗位）</Button>}
    {drafts.length > 10 && <p className="text-label text-text-secondary">每批最多 10 个岗位，请减少所选岗位。</p>}
    {preview && <div className="space-y-4"><p className="text-body font-medium">将联系 {preview.jobs.length} 个岗位 · 每个岗位 {preview.images.length} 张简历图片</p><p className="text-label text-text-secondary">图片：{preview.images.map(image => image.name).join('、') || '本批只发送招呼语'}</p><div className="max-h-96 space-y-4 overflow-y-auto border-y border-line py-3">{preview.jobs.map(job => <article key={job.url}><p className="text-body font-medium">{job.company} · {job.title}</p><p className="mt-2 whitespace-pre-wrap text-body">{job.greeting}</p></article>)}</div>{preview.skipped.map(job => <p key={job.url} className="text-label text-text-secondary">已排除 {job.title}：{job.reason}</p>)}<p className="text-body text-text-secondary">点击官网的沟通入口时，BOSS 可能先发送你账号设置的系统招呼，程序随后发送上方正文和图片。请核对后再执行。</p><label className="flex items-start gap-2 text-body"><input type="checkbox" disabled={pending} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>我已核对整批岗位、招呼语和图片，授权联系这些招聘方，并知晓官网可能先发送系统招呼。</span></label><Button disabled={pending || !confirmed || !connected} onClick={() => void start()}>确认并开始批量投递</Button></div>}
    {run && <div className="space-y-3"><p role="status" className="text-body font-medium">{running ? '批次执行中' : run.state === 'finished' ? '批次已结束' : run.state === 'paused' ? '批次已暂停，请核对结果' : `批次失败：${run.error ?? ''}`}{saved ? ' · 结果已写入本机记录' : ''}</p>{run.tasks.map(task => <article key={task.url} className="border-t border-line pt-3"><p className="text-body">{task.company} · {task.title} · {task.state === 'verified' ? '已投递并核验' : task.state === 'uncertain' ? '待核对，不自动重发' : task.state === 'failed' ? '失败' : task.state === 'running' ? '执行中' : '未执行'}</p><p className="mt-1 text-label text-text-secondary">{task.steps.map(step => `${step.kind === 'contact' ? '建立沟通' : step.kind === 'greeting' ? '招呼语' : '图片'}：${step.state === 'verified' ? '已核验' : step.state === 'pending' ? '待执行' : '待核对'}`).join(' · ')}</p>{task.error && <p className="mt-1 text-body text-danger">{task.error}</p>}</article>)}{running && <Button variant="secondary" disabled={pending} onClick={() => void work(async () => { if (connection) await bossRequest(connection, `/boss-batch/${run.id}/stop`, {}) })}>完成当前步骤后暂停</Button>}{!running && <Button variant="secondary" onClick={() => { setRun(null); setRunId(''); sessionStorage.removeItem(ACTIVE); setPreview(null); setConfirmed(false) }}>准备下一批（自动排除已联系岗位）</Button>}</div>}
    {error && <p role="alert" className="text-body text-danger">{error}</p>}{error && runId && <Button variant="link" onClick={() => setRefresh(value => value + 1)}>重新读取执行状态</Button>}
  </section>
}
