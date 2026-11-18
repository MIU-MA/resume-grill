'use client'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { BossBatchPreview, BrowserRun, BrowserRunSummary } from '@/domain/browser-application'
import type { BossDraft } from './lib/boss-workspace-storage'
import { bossRequest, type BossConnection } from './lib/boss-client'
import { describeBossImages } from './lib/boss-images'
import { encodeAttachment } from '../mail/lib/mail-attachment'
import { saveBossBatch } from '../history/lib/boss-batch-storage'
const ACTIVE = 'boss-browser:live-batch:v1'
const BATCH_STATUS = { running: '执行中', paused: '已暂停', finished: '已结束', failed: '执行失败' } as const
export function BossBatchPanel({ connection, connected, drafts, images, onRunning, disabled = false }: { connection: BossConnection | null; connected: boolean; drafts: BossDraft[]; images: File[]; onRunning: (busy: boolean) => void; disabled?: boolean }) {
  const [preview, setPreview] = useState<BossBatchPreview | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [run, setRun] = useState<BrowserRun | null>(null)
  const [runId, setRunId] = useState('')
  const [recent, setRecent] = useState<BrowserRunSummary[] | null>(null)
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const version = useRef(0), lock = useRef(false)
  const running = run?.state === 'running'
  const remaining = run?.tasks.filter(task => task.state === 'queued' && task.steps.every(step => step.state === 'pending')).length ?? 0
  useEffect(() => { setRunId(sessionStorage.getItem(ACTIVE) ?? '') }, [])
  useEffect(() => { setRecent(null) }, [connection])
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
  const showRecent = () => work(async () => {
    if (!connection) return
    const current = version.current
    const batches = await bossRequest<BrowserRunSummary[]>(connection, '/boss-batches')
    if (version.current === current) setRecent(batches)
  })
  const openBatch = (id: string) => {
    setRecent(null); setRun(null); setSaved(false); setError('')
    sessionStorage.setItem(ACTIVE, id)
    setRunId(id); setRefresh(value => value + 1)
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
    if (preview.greetingMode !== 'platform') throw new Error('请更新本机执行器，旧版本会额外发送自定义招呼语，本次未执行。')
    sessionStorage.setItem(ACTIVE, preview.batchId)
    const id = preview.batchId
    try {
      const value = await bossRequest<BrowserRun>(connection, '/boss-batch/confirm', { id: preview.id, confirmed: true, defaultGreetingAccepted: true })
      setRun(value); setRunId(id); setPreview(null); setConfirmed(false)
      await saveBossBatch(value); setSaved(true)
    } catch (failure) { setRunId(id); setRefresh(value => value + 1); throw failure }
  })
  return <section className="space-y-4 border border-line p-4" aria-label="BOSS 批量投递">
    <div><h2 className="text-section font-semibold">批量投递</h2><p className="mt-2 text-body text-text-secondary">首次沟通由 BOSS 发送账号设置的默认招呼，程序只核对这条消息并发送已选图片，不再追加自定义文字。未确认默认招呼时暂停。</p></div>
    <div className="flex flex-wrap items-center gap-3">
      {!run && <Button disabled={disabled || !!runId || !connection || !connected || pending || !drafts.length || drafts.length > 10} onClick={() => void prepare()}>核对本批投递（{drafts.length} 个岗位）</Button>}
      {!running && !preview && <Button variant="secondary" disabled={!connection || disabled || pending} onClick={() => recent ? setRecent(null) : void showRecent()}>{recent ? '收起最近批次' : '查看最近批次'}</Button>}
      {!connection && <p className="text-label text-text-secondary">打开本机服务输出的工作台链接后，即可查看历史批次。</p>}
    </div>
    {recent && !preview && <div className="divide-y divide-line border-y border-line" aria-label="最近批次">
      {!recent.length && <p className="py-3 text-body text-text-secondary">本机还没有投递批次。</p>}
      {recent.map(batch => <button key={batch.id} type="button" disabled={pending || running || !!preview} onClick={() => openBatch(batch.id)} className="flex w-full flex-wrap items-center justify-between gap-2 px-2 py-3 text-left hover:bg-surface-subtle">
        <span className="text-body">{batch.companies.join('、') || 'BOSS 投递'}</span>
        <span className="text-meta text-text-secondary">{new Date(batch.createdAt).toLocaleString('zh-CN')} · {BATCH_STATUS[batch.state]} · 已核验 {batch.verified}/{batch.total}</span>
      </button>)}
    </div>}
    {drafts.length > 10 && <p className="text-label text-text-secondary">每批最多 10 个岗位，请减少所选岗位。</p>}
    {preview && <div className="space-y-4"><p className="text-body font-medium">将联系 {preview.jobs.length} 个岗位 · 每个岗位 {preview.images.length} 张简历图片</p><p className="text-label text-text-secondary">图片：{preview.images.map(image => image.name).join('、') || '本批只发送招呼语'}</p><div className="max-h-96 space-y-4 overflow-y-auto border-y border-line py-3">{preview.jobs.map(job => <article key={job.url}><p className="text-body font-medium">{job.company} · {job.title}</p><p className="mt-2 text-body text-text-secondary">使用 BOSS 账号默认招呼；不发送自定义草稿。</p></article>)}</div>{preview.skipped.map(job => <p key={job.url} className="text-label text-text-secondary">已排除 {job.title}：{job.reason}</p>)}<p className="text-body text-text-secondary">BOSS 的默认招呼可能包含你之前设置的岗位、到岗时间和实习时长，请先在官网确认模板内容。程序不会再追加第二条文字。</p><label className="flex items-start gap-2 text-body"><input type="checkbox" disabled={pending} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /><span>我已核对整批岗位、账号默认招呼和图片，授权联系这些招聘方，程序不追加自定义招呼语。</span></label><Button disabled={pending || !confirmed || !connected} onClick={() => void start()}>确认并开始批量投递</Button></div>}
    {run && <div className="space-y-3"><p role="status" className="text-body font-medium">{running ? '批次执行中' : run.state === 'finished' ? '批次已结束' : run.state === 'paused' ? '批次已暂停，请核对结果' : `批次失败：${run.error ?? ''}`}{saved ? ' · 结果已写入本机记录' : ''}</p>{run.tasks.map(task => <article key={task.url} className="border-t border-line pt-3"><p className="text-body">{task.company} · {task.title} · {task.state === 'verified' ? '已投递并核验' : task.state === 'uncertain' ? '待核对，不自动重发' : task.state === 'failed' ? '失败' : task.state === 'running' ? '执行中' : '未执行'}</p><p className="mt-1 text-label text-text-secondary">{task.steps.map(step => `${step.kind === 'contact' ? '建立沟通' : step.kind === 'greeting' ? step.source === 'platform' ? '官网招呼' : '招呼语' : '图片'}：${step.state === 'verified' ? '已核验' : step.state === 'pending' ? '待执行' : '待核对'}`).join(' · ')}</p>{task.error && <p className="mt-1 text-body text-danger">{task.error}</p>}</article>)}{running && <Button variant="secondary" disabled={pending} onClick={() => void work(async () => { if (connection) await bossRequest(connection, `/boss-batch/${run.id}/stop`, {}) })}>完成当前步骤后暂停</Button>}{!running && remaining > 0 && <Button variant="secondary" disabled={pending || disabled || !connected} onClick={() => void work(async () => { if (!connection) return; const value = await bossRequest<BossBatchPreview>(connection, `/boss-batch/${run.id}/remaining`, {}); setRun(null); setRunId(''); sessionStorage.removeItem(ACTIVE); setPreview(value); setConfirmed(false) })}>继续未执行的 {remaining} 个岗位</Button>}{!running && <Button variant="secondary" onClick={() => { setRun(null); setRunId(''); sessionStorage.removeItem(ACTIVE); setPreview(null); setConfirmed(false) }}>准备下一批（自动排除已联系岗位）</Button>}</div>}
    {error && <p role="alert" className="text-body text-danger">{error}</p>}{error && runId && <Button variant="link" onClick={() => setRefresh(value => value + 1)}>重新读取执行状态</Button>}
  </section>
}
