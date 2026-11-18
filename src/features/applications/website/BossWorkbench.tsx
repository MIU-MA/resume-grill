'use client'

import { useEffect, useState } from 'react'
import { BossBatchPanel } from './BossBatchPanel'
import { BossBrowserConnection } from './BossBrowserConnection'
import { BossDraftFill } from './BossDraftFill'
import { BossJobDetails } from './BossJobDetails'
import { BossSimulationPanel } from './BossSimulationPanel'
import { BossLivePreview } from './BossLivePreview'
import { Button } from '@/components/ui/Button'
import { listResumeDocuments, type ResumeDocument } from '@/features/resume/lib/resume-library'
import { bossRequest, restoreBossConnection, type BossConnection, type BossStatus } from './lib/boss-client'
import { loadBossWorkspace, saveBossWorkspace, type BossDraft } from './lib/boss-workspace-storage'
import { describeBossImages } from './lib/boss-images'
import { renderResumePdfImages } from '@/features/resume/lib/pdf-images'
import type { BossJobRead } from '@/domain/boss-search'
import type { prepareBossApplications } from './lib/boss-preparation'

export function BossWorkbench() {
  const [connection, setConnection] = useState<BossConnection | null>(null)
  const [status, setStatus] = useState<BossStatus | null>(null)
  const [resumes, setResumes] = useState<ResumeDocument[]>([])
  const [resumeId, setResumeId] = useState('')
  const [target, setTarget] = useState('')
  const [read, setRead] = useState<Extract<BossJobRead, { state: 'ready' }> | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [drafts, setDrafts] = useState<BossDraft[]>([])
  const [images, setImages] = useState<File[]>([])
  const [urls, setUrls] = useState<string[]>([])
  const [commandBusy, setBusy] = useState(false)
  const [batchBusy, setBatchBusy] = useState(false), [simulationBusy, setSimulationBusy] = useState(false)
  const busy = commandBusy || batchBusy || simulationBusy
  const [error, setError] = useState('')
  const [connectionError, setConnectionError] = useState('')
  const [notice, setNotice] = useState('')
  const [ready, setReady] = useState(false)
  const resume = resumes.find(item => item.id === resumeId)
  const resumeText = resume?.review?.rawText ?? resume?.extracted.text ?? ''

  useEffect(() => {
    let active = true
    void Promise.all([listResumeDocuments(), loadBossWorkspace()]).then(([documents, saved]) => {
      if (!active) return
      setResumes(documents)
      const source = documents.find(item => item.id === saved?.resumeId)
      setResumeId(source?.id ?? documents[0]?.id ?? '')
      if (saved) {
        setTarget(saved.target)
        if (source?.updatedAt === saved.resumeUpdatedAt && (source.review?.rawText ?? source.extracted.text) === saved.resumeText) { setDrafts(saved.drafts); setImages(saved.images) }
        else setNotice('简历版本已变化，请重新准备招呼语。')
      }
      setReady(true)
    }).catch(() => { if (active) setError('简历或草稿读取失败，请重新打开页面。') })
    try { setConnection(restoreBossConnection()) } catch { setError('本机连接已失效，请使用服务新输出的链接。') }
    return () => { active = false }
  }, [])
  useEffect(() => {
    const next = images.map(file => URL.createObjectURL(file)); setUrls(next)
    return () => next.forEach(url => URL.revokeObjectURL(url))
  }, [images])
  useEffect(() => {
    if (!connection) return
    let active = true, timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try { const value = await bossRequest<BossStatus>(connection, '/status'); if (active) { setStatus(value); setConnectionError(value.error || '') } }
      catch (failure) { if (active) { setStatus(null); setConnectionError(failure instanceof Error ? failure.message : '无法连接本机服务') } }
      if (active) timer = setTimeout(poll, 3000)
    }
    void poll()
    return () => { active = false; clearTimeout(timer) }
  }, [connection])

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('')
    try { await action() } catch (failure) { setError(failure instanceof Error ? failure.message : '操作失败') } finally { setBusy(false) }
  }
  const request = <T,>(path: string, body?: unknown) => {
    if (!connection) throw new Error('先连接本机浏览器服务。')
    return bossRequest<T>(connection, path, body)
  }
  const invalidate = () => { setDrafts([]); setNotice('') }
  const readJobs = (query?: string) => run(async () => {
    setRead(null); setSelected([]); invalidate()
    const result = query
      ? await request<BossJobRead>('/search', { query })
      : await request<BossJobRead>('/jobs')
    if (!result.state) throw new Error('请重启本机 BOSS 服务，再打开终端新输出的工作台链接。')
    if (result.state === 'ready') {
      if (query && query !== result.query) {
        setNotice('BOSS 正在切换搜索结果，列表出现后可点「读取岗位」。')
        return
      }
      setRead(result)
      setSelected(result.jobs.map(job => job.url))
      return
    }
    if (result.state === 'login' || result.state === 'verification' || result.state === 'unsupported') throw new Error(result.message)
    setNotice(result.message)
  })
  const prepare = () => run(async () => {
    if (!read) return
    let attachments = images
    if (!attachments.length && resume?.originalFile && (resume.originalFile.type === 'application/pdf' || /\.pdf$/i.test(resume.originalFile.name))) {
      attachments = await renderResumePdfImages(resume.originalFile)
      setImages(attachments)
    }
    const metadata = await describeBossImages(attachments)
    const result = await request<ReturnType<typeof prepareBossApplications>>('/prepare', { readId: read.readId, target, resumeText, selectedUrls: selected, images: metadata })
    setDrafts(result.prepared)
    setNotice(`已准备 ${result.prepared.length} 个岗位、${attachments.length} 张简历图片。${result.skipped.length ? `跳过 ${result.skipped.length} 个不匹配或未选岗位。` : ''}`)
  })
  const inputClass = 'w-full border border-line bg-surface px-3 py-2 text-body disabled:opacity-50'
  return <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
    <div className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
      <BossBrowserConnection connection={connection} status={status} busy={busy} onConnection={value => { setConnection(value); setStatus(null); setConnectionError('') }} onStatus={setStatus} onCommand={run} />
      {(error || connectionError) && <p role="alert" className="border border-line bg-danger-soft p-3 text-body text-danger">{error || connectionError}</p>}
      {notice && <p role="status" className="text-body text-text-secondary">{notice}</p>}
      <section className="grid gap-4 border border-line p-4 md:grid-cols-2">
        <label className="space-y-2 text-label"><span>已有简历</span><select className={inputClass} value={resumeId} disabled={!ready || busy} onChange={event => { setResumeId(event.target.value); setImages([]); invalidate() }}>{!resumes.length && <option value="">先在简历库导入简历</option>}{resumes.map(item => <option key={item.id} value={item.id}>{item.sourceFile}</option>)}</select></label>
        <label className="space-y-2 text-label"><span>想找什么岗位</span><input className={inputClass} value={target} maxLength={120} disabled={busy} placeholder="例如：全栈开发、产品经理" onChange={event => { setTarget(event.target.value); setRead(null); setSelected([]); invalidate() }} /></label>
        <div className="flex flex-wrap items-center gap-2 md:col-span-2">
          <Button disabled={busy || !status?.ready || !target.trim()} onClick={() => void readJobs(target.trim())}>官网搜索</Button>
          <Button variant="secondary" disabled={busy || !status?.ready} onClick={() => void readJobs()}>读取岗位</Button>
        </div>
      </section>
      <BossLivePreview connection={connection} connected={!!status?.ready} />
      {read && <section className="border border-line"><h2 className="border-b border-line px-4 py-3 text-section font-medium">选择岗位 · {read.jobs.length}</h2><div className="max-h-72 divide-y divide-line overflow-y-auto">{read.jobs.map(job => <label key={job.url} className="flex items-start gap-3 p-3 text-body"><input type="checkbox" className="mt-1" checked={selected.includes(job.url)} disabled={busy} onChange={event => { setSelected(items => event.target.checked ? [...items, job.url] : items.filter(url => url !== job.url)); invalidate() }} /><span className="flex-1">{job.title}<span className="ml-3 text-label text-text-secondary">{job.company}</span></span><a href={job.url} target="_blank" rel="noreferrer" className="text-label underline">查看官网</a></label>)}</div></section>}
      {read && <BossJobDetails connection={connection} readId={read.readId} jobs={read.jobs.filter(job => selected.includes(job.url))} disabled={busy || !status?.ready} onBusy={setBusy} onChanged={() => setDrafts([])} />}
      <section className="border border-line p-4"><p className="mb-3 text-body text-text-secondary">PDF 简历会在准备投递时生成图片，保留原排版和照片。也可选择自己的图片。</p><label className="block text-label">自备图片（可选，最多 3 张）<input className="mt-2 block w-full text-label" type="file" accept="image/png,image/jpeg" multiple disabled={busy} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void run(async () => { await describeBossImages(files); setImages(files); invalidate() }) }} /></label><div className="mt-3 flex gap-3 overflow-x-auto">{urls.map((url, index) => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt={images[index]?.name ?? '简历图片'} className="h-48 w-auto border border-line object-contain" /></a>)}</div><div className="mt-4 flex items-center gap-3"><Button disabled={busy || !read || !resumeText || !target.trim() || !selected.length || !status?.ready} onClick={() => void prepare()}>准备投递</Button><span className="text-meta text-text-secondary">引用所选简历的原文，不编造经历；图片留在本机。</span></div></section>
      {drafts.length > 0 && <section className="space-y-4"><div className="flex items-center justify-between gap-3"><h2 className="text-section font-medium">自定义草稿（仅手动填写） · {drafts.length}</h2><Button variant="secondary" disabled={busy || !resume} onClick={() => void run(async () => { if (!resume) return; await saveBossWorkspace({ target, resumeId, resumeUpdatedAt: resume.updatedAt, resumeText, drafts, images, savedAt: Date.now() }); setNotice('已保存准备草稿。尚未发送，不计入投递记录。') })}>保存草稿</Button></div>{drafts.map((draft, index) => <article key={draft.url} className="border border-line p-4"><div className="mb-3 flex justify-between gap-3"><h3 className="text-body font-medium">{draft.company} · {draft.title}</h3><a className="text-label underline" href={draft.url} target="_blank" rel="noreferrer">打开岗位</a></div><textarea aria-label={`${draft.title}招呼语`} className={inputClass + ' min-h-28'} maxLength={1000} disabled={busy} value={draft.greeting} onChange={event => setDrafts(items => items.map((item, i) => i === index ? { ...item, greeting: event.target.value } : item))} /><p className="mt-2 text-meta text-text-secondary">图片：{images.map(file => file.name).join('、') || '未选择'}</p><details className="mt-2 text-label text-text-secondary"><summary className="cursor-pointer">引用依据与待核对项</summary><p className="my-2 whitespace-pre-wrap">{draft.evidence || '未找到对应经历，需手动核对。'}</p>{draft.checks.map(check => <p key={check}>{check}</p>)}</details><details className="mt-3 text-label"><summary className="cursor-pointer">手动填写已有会话</summary><BossDraftFill browserName={status?.backend === 'ego' ? 'ego' : 'Chrome'} connection={connection} connected={!!status?.ready} disabled={busy} company={draft.company} title={draft.title} url={draft.url} text={draft.greeting} onBusy={setBusy} /></details></article>)}<details className="text-label"><summary className="cursor-pointer">开发验证（不联系招聘方）</summary><BossSimulationPanel connection={connection} drafts={drafts} images={images} onRunning={setSimulationBusy} disabled={busy} /></details></section>}
      <BossBatchPanel connection={connection} connected={!!status?.ready} drafts={drafts} images={images} onRunning={setBatchBusy} disabled={busy} />
    </div>
  </div>
}
