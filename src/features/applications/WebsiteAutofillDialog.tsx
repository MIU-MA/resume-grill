'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { MailSender } from '@/domain/mail-schema'
import { PROFILE_LABELS, type WebsiteProfile, type WebsiteSnapshot } from '@/domain/website-automation'
import { loadResumeDocument } from '@/features/resume/lib/resume-library'
import { extensionRequest, loadWebsiteProfile, makeWebsiteBatch, saveWebsiteProfile, seedWebsiteProfile, websiteTargets } from './website-automation'
import type { Draft } from './draft-state'

const labels = { pending: '待读取', opening: '打开页面中', filling: '填写中', waiting: '需处理', ready: '待核对提交', done: '已手动确认提交', skipped: '已跳过' }
export function WebsiteAutofillDialog({ drafts, attachment, resumeId, sender, initialUrls = {}, onClose }: { drafts: Draft[]; attachment: File | null; resumeId?: string; sender?: MailSender | null; initialUrls?: Record<string, string>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [profile, setProfile] = useState<WebsiteProfile>({})
  const [urls, setUrls] = useState<Record<string, string>>(initialUrls)
  const [connected, setConnected] = useState(false)
  const [queue, setQueue] = useState<WebsiteSnapshot | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const targets = websiteTargets(drafts)
  useEffect(() => {
    dialog.current?.showModal()
    let active = true
    void Promise.all([loadWebsiteProfile(), resumeId ? loadResumeDocument(resumeId) : Promise.resolve(undefined)]).then(async ([saved, doc]) => {
      const initial = { ...seedWebsiteProfile(doc?.review?.rawText ?? doc?.extracted.text ?? '', sender), ...saved }
      try {
        const snapshot = await extensionRequest<WebsiteSnapshot | null>('snapshot')
        if (active) { setConnected(true); setQueue(snapshot); setProfile({ ...initial, ...snapshot?.profile }) }
      } catch { if (active) setProfile(initial) }
      if (active) setReady(true)
    }).catch(() => { if (active) setError('填写资料未能读取，请检查浏览器存储。') })
    const timer = setInterval(() => { void extensionRequest<WebsiteSnapshot | null>('snapshot').then(snapshot => { if (active) { setConnected(true); setQueue(snapshot) } }).catch(() => { if (active) setConnected(false) }) }, 4000)
    return () => { active = false; clearInterval(timer) }
    // Snapshot the selected resume and sender when this dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const field = (key: keyof WebsiteProfile) => <label key={key} className="mail-label">{PROFILE_LABELS[key]}<input className="mail-input" maxLength={200} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} value={profile[key] ?? ''} onChange={event => setProfile(current => ({ ...current, [key]: event.target.value }))} /></label>
  return <dialog ref={dialog} onCancel={event => { if (busy) event.preventDefault(); else onClose() }} aria-label="官网批量填写" className="mail-dialog resume-workbench w-[760px] max-w-[calc(100vw-24px)] border border-line-strong bg-surface p-0 text-text-primary backdrop:bg-black/30">
    <header className="flex items-center justify-between border-b border-line px-5 py-4"><h2 className="m-0 text-[16px] font-semibold">官网批量填写</h2><Button variant="ghost" className="size-8 p-0" aria-label="关闭官网填写" disabled={busy} onClick={onClose}><X size={17} /></Button></header>
    <div className="max-h-[72vh] space-y-4 overflow-y-auto p-5 text-[12px]">
      <p className="m-0 leading-relaxed text-text-secondary">选中的官网岗位会依次打开并填写资料、附上简历。需要登录、验证码或补充资料的页面会保留，其余岗位继续；提交前在官网核对。</p>
      {!connected && <section className="border border-line bg-surface-soft p-3"><strong className="font-medium">首次使用：安装 Chrome / Edge 扩展</strong><ol className="my-2 space-y-1 pl-5"><li><a href="/generated/website-extension.zip" download className="text-accent underline">下载官网填写扩展</a>，解压到固定目录。</li><li>打开浏览器的扩展管理页，开启开发者模式，加载解压后的 <code>website-extension</code> 目录。</li><li>刷新工作台，再打开此面板。扩展固定到工具栏后，可随时查看进度。</li></ol><p className="mb-0 text-text-tertiary">只需安装一次；首次填写某个官网时，由扩展申请该站点的访问权限。</p></section>}
      <div className="grid gap-3 sm:grid-cols-3">{field('name')}{field('email')}{field('phone')}</div>
      <details className="border-y border-line py-3"><summary className="cursor-pointer text-text-secondary">学校、工作经历和个人链接 · 可稍后补充</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{(Object.keys(PROFILE_LABELS) as Array<keyof WebsiteProfile>).filter(key => !['name', 'email', 'phone'].includes(key)).map(field)}</div><p className="mb-0 mt-3 text-text-tertiary">时间使用 YYYY-MM 或 YYYY-MM-DD。多段经历、自定义下拉框及特殊问题在官网核对；缺项可以在扩展中补充并复用。</p></details>
      <section><strong className="font-medium">本批 {targets.length} 个官网岗位 · {attachment?.name ?? '尚未选择简历附件'}</strong>{targets.map(({ draft, links, url }) => <div key={draft.id} className="mt-2 border-t border-line pt-2"><span>{draft.company} / {draft.role}</span>{links.length > 1 ? <select className="mail-input mt-1" aria-label={`${draft.company} 申请入口`} value={urls[draft.id] ?? ''} onChange={event => setUrls(current => ({ ...current, [draft.id]: event.target.value }))}><option value="">选择申请入口</option>{links.map(link => <option key={link.url} value={link.url}>{link.label || link.url}</option>)}</select> : <span className="ml-2 break-all text-text-tertiary">{new URL(url).hostname}{!links.length ? ' · 进入表单后可继续填写' : ''}</span>}</div>)}</section>
      {queue && <section className="border border-line p-3"><strong className="font-medium">扩展中的任务 · {queue.running ? '正在处理' : '进度已保存'}</strong><p className="my-1 text-text-tertiary">简历：{queue.attachmentName}。补充资料、继续填写、暂停或跳过，请打开浏览器工具栏中的扩展。</p><div className="mt-2 space-y-1">{queue.jobs.map(job => <div key={job.id} className="flex gap-3"><span className="min-w-0 flex-1 truncate">{job.company} / {job.role}</span><span className={job.status === 'waiting' ? 'text-warning' : 'text-text-secondary'}>{labels[job.status]}</span></div>)}</div></section>}
      {error && <p role="alert" className="m-0 text-danger">{error}</p>}{message && <p role="status" className="m-0 text-success">{message}</p>}
    </div>
    <footer className="flex justify-end gap-2 border-t border-line bg-surface-soft px-5 py-3"><Button variant="secondary" disabled={busy} onClick={onClose}>关闭</Button><Button loading={busy} disabled={!ready || !connected || !targets.length || !attachment} onClick={() => {
      setBusy(true); setError(''); setMessage('')
      void (async () => { await saveWebsiteProfile(profile); const batch = await makeWebsiteBatch(drafts, urls, profile, attachment); const snapshot = await extensionRequest<WebsiteSnapshot>('stage', batch); setQueue(snapshot); setMessage('已同步到扩展。点击浏览器工具栏中的 Resume Grill，允许官网访问并开始。') })().catch(cause => setError(cause instanceof Error ? cause.message : '同步失败，请重试。')).finally(() => setBusy(false))
    }}>准备整批官网填写</Button></footer>
  </dialog>
}
