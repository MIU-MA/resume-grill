'use client'

import { useEffect, useRef, useState } from 'react'
import { get, set } from 'idb-keyval'
import { ArrowLeft, ExternalLink, FilePlus2, Mail, Paperclip, Pause, Play, Plus, Settings, Trash2 } from 'lucide-react'
import type { Mode } from '@/application/types'
import { WorkbenchFrame } from '@/components/layout/WorkbenchFrame'
import { Button } from '@/components/ui/Button'
import { WorkspaceSidebar, type SidebarBadges } from '@/features/workspace/WorkspaceSidebar'
import { applicationTemplate, batchSchema, mailDraftSchema, MAIL_STATUS_LABELS, MAX_ATTACHMENT_BYTES, type CareerPage, type MailBatch, type MailDraft, type MailJob } from '@/domain/mail-schema'
import { useMailAgent } from './use-mail-agent'
import { MailSettings } from './MailSettings'
import { MailPreview } from './MailPreview'
import { LinkImporter } from './LinkImporter'

type Draft = Omit<MailDraft, 'sourceConfirmed'> & { sourceConfirmed: boolean; automatic?: boolean; extraction?: CareerPage }
type DraftStore = { drafts: Draft[]; attachment: File | null }
const STORAGE_KEY = 'mail-workbench:drafts:v1'
function isJob(value: Draft | MailJob): value is MailJob { return 'status' in value }
function draftPayload({ id, company, role, sourceUrl, recipient, subject, body }: Draft) {
  return { id, company, role, sourceUrl, recipient, subject, body, sourceConfirmed: true as const }
}

async function encodeAttachment(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('无法读取简历附件，请重新选择'))
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.readAsDataURL(file)
  })
}
function safeLink(value: string) {
  try { return new URL(value).protocol === 'https:' ? value : undefined } catch { return undefined }
}

export function MailWorkbench({ badges, onNavigate, onHome }: { badges: SidebarBadges; onNavigate: (mode: Mode) => void; onHome: () => void }) {
  const agent = useMailAgent()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [attachment, setAttachment] = useState<File | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'drafts' | 'history'>('drafts')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [page, setPage] = useState<(CareerPage & { draftId: string }) | null>(null)
  const [preview, setPreview] = useState<MailBatch | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const snapshot = agent.snapshot
  const jobs = snapshot?.jobs ?? []
  const selected = tab === 'drafts' ? drafts.find(item => item.id === selectedId) ?? drafts[0] : jobs.find(item => item.id === selectedId) ?? jobs.at(-1)
  const pending = jobs.filter(job => job.status === 'queued').length
  const readyDrafts = drafts.filter(draft => mailDraftSchema.safeParse(draftPayload(draft)).success)
  const extractedPage = page?.draftId === selected?.id ? page : (selected as Draft | undefined)?.extraction
  const sourcePage = extractedPage?.url === selected?.sourceUrl ? extractedPage : undefined

  useEffect(() => {
    const name = snapshot?.sender?.name
    if (!name) return
    setDrafts(current => {
      let changed = false
      const next = current.map(draft => {
        if (!draft.automatic || !draft.company || !draft.role) return draft
        const text = applicationTemplate(name, draft.company, draft.role)
        if (text.subject === draft.subject && text.body === draft.body) return draft
        changed = true
        return { ...draft, ...text }
      })
      return changed ? next : current
    })
  }, [snapshot?.sender?.name, drafts])

  useEffect(() => {
    void get<DraftStore>(STORAGE_KEY).then(saved => {
      if (saved) { setDrafts(saved.drafts); setAttachment(saved.attachment) }
      setHydrated(true)
    }).catch(() => setError('无法读取浏览器中的投递草稿，请检查浏览器存储权限后刷新。'))
  }, [])
  useEffect(() => {
    if (hydrated) void set(STORAGE_KEY, { drafts, attachment }).catch(() => setError('草稿未能保存到浏览器，刷新前请备份填写内容。'))
  }, [drafts, attachment, hydrated])
  useEffect(() => {
    if (!snapshot) return
    const submitted = new Set(snapshot.jobs.map(job => job.id))
    setDrafts(current => current.some(item => submitted.has(item.id)) ? current.filter(item => !submitted.has(item.id)) : current)
  }, [snapshot])

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await work() } catch (e) { setError(e instanceof Error ? e.message : '操作失败') }
    finally { setBusy(false) }
  }
  const update = (change: Partial<Draft>) => {
    if (!selected || tab !== 'drafts') return
    setDrafts(items => items.map(item => item.id === selected.id ? {
      ...item, ...change,
      ...(('body' in change || 'subject' in change) ? { automatic: false } : {}),
      ...(('recipient' in change || 'sourceUrl' in change) ? { sourceConfirmed: false } : {}),
    } : item))
  }
  const addDraft = () => {
    if (drafts.length >= 20) { setError('每批最多 20 封，请先发送或移除当前草稿'); return }
    const draft: Draft = { id: crypto.randomUUID(), company: '', role: '', sourceUrl: '', recipient: '', subject: '', body: '', sourceConfirmed: false, automatic: true }
    setDrafts(items => [...items, draft]); setSelectedId(draft.id); setTab('drafts'); setError('')
  }
  const preparePreview = async () => {
    if (!snapshot?.sender) { setSettingsOpen(true); return }
    if (!attachment) throw new Error('请先选择这批投递要附上的简历原文件')
    const prepared = readyDrafts.map(draftPayload)
    const parsed = batchSchema.safeParse({ id: crypto.randomUUID(), sender: snapshot.sender, jobs: prepared, attachment: { name: attachment.name, base64: await encodeAttachment(attachment) } })
    if (!parsed.success) {
      const index = parsed.error.issues.find(issue => issue.path[0] === 'jobs')?.path[1]
      if (typeof index === 'number') setSelectedId(drafts[index]?.id ?? null)
      const target = typeof index === 'number' ? drafts[index] : undefined
      const missing = target ? [['公司', target.company], ['岗位', target.role], ['招聘邮箱', target.recipient], ['主题', target.subject], ['正文', target.body]].filter(([, value]) => !value.trim()).map(([label]) => label).join('、') : ''
      throw new Error(`请检查${typeof index === 'number' ? `第 ${index + 1} 个岗位` : '投递内容'}${missing ? `，还缺：${missing}` : '的邮箱、官网链接或附件格式'}。`)
    }
    setPreview(parsed.data)
  }
  const jobAction = async (job: MailJob, action: 'retry' | 'cancel' | 'confirm-sent') => {
    if (job.status === 'uncertain' && !window.confirm(action === 'confirm-sent' ? '已核对邮箱发信记录，确认这封邮件已经发出？' : '取消本条不会撤回邮件；如需再次投递，请先核实上次发送结果。继续取消？')) return
    await agent.command('/job', { id: job.id, action })
  }

  return <WorkbenchFrame className="flex">
    <WorkspaceSidebar mode="applications" collapsed={collapsed} onToggleCollapsed={() => setCollapsed(value => !value)} onNavigate={onNavigate} badges={badges} onOpenHistory={onHome} onOpenSettings={() => setSettingsOpen(true)} variant="dock" />
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-14 flex-none items-center gap-3 border-b border-line px-4 sm:px-5">
        <Button variant="ghost" className="size-8 p-0 md:hidden" aria-label="返回简历库" onClick={onHome}><ArrowLeft size={17} /></Button>
        <h1 className="m-0 whitespace-nowrap text-[16px] font-semibold">邮箱投递</h1>
        <span className="min-w-0 truncate text-[12px] text-text-tertiary max-sm:hidden">{snapshot?.sender?.address ?? (snapshot ? '执行器已连接 · 尚未连接邮箱' : '本机执行器未连接')}</span>
        <Button variant="secondary" className="ml-auto h-8 px-3 text-[12px]" onClick={() => setSettingsOpen(true)}><Settings size={14} />{snapshot?.sender ? '邮箱设置' : '连接邮箱'}</Button>
      </header>
      <div className="flex flex-none flex-wrap items-center gap-2 border-b border-line bg-surface-soft px-4 py-3 sm:px-5">
        <input ref={fileInput} hidden type="file" accept=".pdf,.docx,.txt" onChange={event => {
          const file = event.target.files?.[0]
          if (file) {
            if (!file.size || file.size > MAX_ATTACHMENT_BYTES || !/\.(pdf|docx|txt)$/i.test(file.name)) setError('请选择 5 MB 以内的 PDF、DOCX 或 TXT 简历')
            else { setAttachment(file); setError('') }
          }
          event.target.value = ''
        }} />
        <Button variant="secondary" className="h-8 px-3 text-[12px]" disabled={!hydrated || !!preview} onClick={() => fileInput.current?.click()}><Paperclip size={14} />选择简历附件</Button>
        <span className="min-w-0 flex-1 truncate text-[12px] text-text-secondary" title={attachment?.name}>{attachment ? `${attachment.name} · ${Math.max(1, Math.ceil(attachment.size / 1024))} KB` : '选择原文件，随本批每封邮件发送'}</span>
        {attachment && <button aria-label="移除简历附件" title="移除简历附件" className="grid size-7 place-items-center text-text-tertiary hover:bg-surface-hover" disabled={!!preview} onClick={() => setAttachment(null)}><Trash2 size={13} /></button>}
        <Button className="h-8 px-3 text-[12px]" disabled={!readyDrafts.length || busy || snapshot?.running || pending > 0 || !!snapshot?.fatalError} onClick={() => void run(preparePreview)}>预览可投递 ({readyDrafts.length})</Button>
      </div>
      {(error || agent.connectionError || snapshot?.fatalError) && <div role="alert" className="flex-none border-b border-line bg-danger-soft px-5 py-2 text-[12px] leading-relaxed text-danger">{error || agent.connectionError || snapshot?.fatalError}</div>}
      {tab === 'drafts' && <LinkImporter onBusy={setBusy} existingUrls={drafts.map(draft => draft.sourceUrl)} slots={20 - drafts.length} connected={!!snapshot} onConnect={() => setSettingsOpen(true)} read={url => agent.request<CareerPage>('/extract', { url })} onImported={result => {
        const id = crypto.randomUUID()
        const draft: Draft = { id, company: result.company ?? '', role: result.role ?? '', sourceUrl: result.url, recipient: result.recommendedEmail ?? '', subject: '', body: '', sourceConfirmed: false, automatic: true, extraction: result }
        setDrafts(items => items.length >= 20 || items.some(item => item.sourceUrl === result.url) ? items : [...items, draft]); setSelectedId(id); setError('')
      }} />}
      <div className="mail-work-area min-h-0 flex-1">
        <section className="mail-list flex min-h-0 min-w-0 flex-col border-r border-line" aria-label="投递清单">
          <div className="flex h-11 flex-none items-center border-b border-line px-3">
            {(['drafts', 'history'] as const).map(value => <button key={value} className={`h-full border-b-2 px-2 text-[12px] ${tab === value ? 'border-brand font-semibold' : 'border-transparent text-text-tertiary'}`} onClick={() => { setTab(value); setSelectedId(null); setError('') }}>{value === 'drafts' ? `待投递 ${drafts.length}` : `投递记录 ${jobs.length}`}</button>)}
            <button className="ml-auto flex items-center gap-1 px-1 py-2 text-[11px] text-text-tertiary hover:bg-surface-hover" disabled={!hydrated || busy} onClick={addDraft} aria-label="手动补录岗位" title="手动补录岗位"><Plus size={13} />补录</button>
          </div>
          {tab === 'history' && (pending > 0 || snapshot?.running) && <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-soft px-3 py-2 text-[12px]">
            <span className="mr-auto">{snapshot?.running ? (snapshot.paused ? '完成当前邮件后暂停' : '正在发送') : `待继续 ${pending} 封`}</span>
            <Button variant="secondary" className="h-7 px-2 text-[12px]" disabled={busy || !snapshot?.sender || !!snapshot?.fatalError} onClick={() => void run(() => agent.command(snapshot?.running ? '/pause' : '/resume'))}>{snapshot?.running ? <Pause size={12} /> : <Play size={12} />}{snapshot?.running ? '暂停' : '继续发送'}</Button>
          </div>}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {(tab === 'drafts' ? drafts : [...jobs].reverse()).map((item, index) => <button key={item.id} className={`block w-full border-b border-line px-4 py-3 text-left ${selected?.id === item.id ? 'border-l-2 border-l-brand bg-brand-soft' : 'border-l-2 border-l-transparent hover:bg-surface-soft'}`} onClick={() => setSelectedId(item.id)}>
              <span className="flex items-baseline gap-2"><strong className="min-w-0 flex-1 truncate text-[13px] font-semibold">{item.company || `新岗位 ${index + 1}`}</strong>{isJob(item) && <span className={`whitespace-nowrap text-[11px] ${item.status === 'failed' || item.status === 'uncertain' ? 'text-danger' : 'text-text-tertiary'}`}>{MAIL_STATUS_LABELS[item.status]}</span>}</span>
              <span className="mt-1 block truncate text-[12px] text-text-secondary">{item.role || '待填写岗位'}</span>
              <span className="mt-1 block truncate text-[11px] text-text-tertiary">{item.recipient || '需核对招聘邮箱'}{!isJob(item) && !readyDrafts.some(draft => draft.id === item.id) ? ' · 待补充' : ''}</span>
            </button>)}
            {(tab === 'drafts' ? !drafts.length : !jobs.length) && <div className="px-4 py-6 text-[12px] leading-[1.8] text-text-tertiary">{tab === 'drafts' ? '把官网上想投的岗位加入清单，写好邮件后一起发送。' : snapshot ? '发送后会在这里留下记录。' : '连接本机执行器后读取投递记录。'}</div>}
          </div>
          <div className="flex-none border-t border-line px-4 py-2 text-[11px] leading-relaxed text-text-tertiary">{tab === 'drafts' ? `${readyDrafts.length} 个可预览 · ${drafts.length - readyDrafts.length} 个待补充，暂不发送` : '投递记录保存在本机执行器'}</div>
        </section>
        <section className="min-h-0 min-w-0 overflow-y-auto" aria-label={tab === 'drafts' ? '编辑投递邮件' : '投递详情'}>
          {!selected && tab === 'history' ? <div className="px-6 py-9 text-[13px] text-text-secondary"><h2 className="m-0 text-[16px] font-semibold text-text-primary">投递记录</h2><p>{snapshot ? '发送后，可在这里查看每封邮件的内容和结果。' : '连接本机执行器后查看已有记录。'}</p></div> : !selected ? <div className="mx-auto max-w-[600px] px-6 py-9 sm:px-8">
            <Mail size={24} className="mb-5 text-text-tertiary" />
            <h2 className="mb-3 text-[19px] font-semibold">把想投的岗位链接粘贴到上方</h2>
            <p className="text-[13px] leading-[1.9] text-text-secondary">一次添加多个招聘详情页。公司、岗位和招聘邮箱会从页面整理到清单，邮件正文自动填好；没识别出的内容再补。</p>
            <ol className="my-6 list-none divide-y divide-line border-y border-line p-0 text-[13px]">
              <li className="flex gap-4 py-4"><span className="font-mono text-text-tertiary">01</span><span>连接 QQ／163 邮箱，选择简历附件</span></li>
              <li className="flex gap-4 py-4"><span className="font-mono text-text-tertiary">02</span><span>粘贴链接，自动整理投递清单</span></li>
              <li className="flex gap-4 py-4"><span className="font-mono text-text-tertiary">03</span><span>确认整批内容，执行器逐封发送</span></li>
            </ol>
            <Button variant="secondary" disabled={!hydrated || busy} onClick={addDraft}><FilePlus2 size={15} />没有可读取的链接？手动补录</Button>
            <p className="mt-5 text-[12px] leading-relaxed text-text-tertiary">官网没有公开招聘邮箱时，需要按页面提供的申请方式投递。</p>
          </div> : tab === 'drafts' ? <div className="mail-editor mx-auto max-w-[860px] space-y-4 p-5 sm:p-6">
            <div className="flex items-center justify-between"><h2 className="m-0 text-[14px] font-semibold">岗位与邮件</h2><Button variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => setDrafts(items => items.filter(item => item.id !== selected.id))}><Trash2 size={13} />移除草稿</Button></div>
            {sourcePage?.notes?.length ? <div className="border-l-2 border-line-strong bg-surface-soft px-3 py-2 text-[12px] leading-relaxed text-text-secondary">{sourcePage.notes.map(note => <p className="my-1" key={note}>{note}</p>)}</div> : null}
            <details key={selected.id} open={!selected.company || !selected.role || !selected.recipient} className="border-y border-line py-3">
            <summary className="cursor-pointer text-[13px] font-medium">{selected.company && selected.role ? `${selected.company} / ${selected.role}` : '补充未识别的信息'}<span className="ml-2 text-[12px] font-normal text-text-tertiary">{selected.recipient || '招聘邮箱待核对'} · 展开修改</span></summary>
            <div className="mt-4 space-y-3">
            <label className="mail-label">官网招聘页<div className="flex gap-2"><input className="mail-input min-w-0 flex-1" type="url" placeholder="https://公司官网/招聘详情" value={selected.sourceUrl} onChange={e => { update({ sourceUrl: e.target.value }); setPage(null) }} /><Button variant="secondary" className="h-9 shrink-0 px-3 text-[12px]" loading={busy} disabled={!selected.sourceUrl || !snapshot} onClick={() => void run(async () => {
              const id = selected.id; const original = selected.sourceUrl
              const result = await agent.request<CareerPage>('/extract', { url: original })
              setPage({ ...result, draftId: id })
              setDrafts(items => items.map(item => item.id === id && item.sourceUrl === original ? { ...item, sourceUrl: result.url, company: item.company || result.company || '', role: item.role || result.role || '', recipient: item.recipient || result.recommendedEmail || '', extraction: result, automatic: !item.body && !item.subject ? true : item.automatic, sourceConfirmed: false } : item))
            })}>重新识别</Button></div></label>
            {!snapshot && <p className="!mt-2 text-[12px] text-text-tertiary">连接执行器后可读取网页，也可以先手动填写官网公开的招聘邮箱。</p>}
            {sourcePage && <div className="border border-line bg-surface-soft p-3 text-[12px]">
              <p className="mb-2 mt-0 font-medium">{sourcePage.title || '页面中的邮箱'} · {sourcePage.emails.length} 个</p>
              {sourcePage.emails.length ? <div className="max-h-40 space-y-2 overflow-y-auto">{sourcePage.emails.map(candidate => <button className="block w-full border border-line bg-white p-2 text-left hover:border-line-strong" key={candidate.email} onClick={() => update({ recipient: candidate.email })}><span className="break-all font-medium">{candidate.email}</span><span className="mt-1 block text-[11px] leading-relaxed text-text-tertiary">{candidate.context}</span></button>)}</div> : <p className="m-0 leading-relaxed text-text-secondary">未读到公开邮箱。页面可能需要登录或通过脚本加载，请打开官网核对，或按官网提供的方式申请。</p>}
              <p className="mb-0 mt-2 text-[11px] text-text-tertiary">页面可能包含客服等其他邮箱，请根据上下文选择。</p>
            </div>}
            <div className="grid grid-cols-2 gap-3"><label className="mail-label">公司<input className="mail-input" maxLength={120} placeholder="公司名称" value={selected.company} onChange={e => update({ company: e.target.value })} /></label><label className="mail-label">岗位<input className="mail-input" maxLength={120} placeholder="岗位名称 / 编号" value={selected.role} onChange={e => update({ role: e.target.value })} /></label></div>
            <label className="mail-label">收件邮箱<input className="mail-input" type="email" placeholder="官网公开的招聘邮箱" value={selected.recipient} onChange={e => update({ recipient: e.target.value })} /></label>
            </div></details>
            <div className="border-t border-line pt-4">
              <div className="mb-2 flex items-center justify-between"><span className="text-[12px] font-medium text-text-secondary">邮件内容</span><button className="text-[12px] text-text-secondary underline disabled:opacity-40" disabled={!selected.company || !selected.role || !snapshot?.sender?.name} onClick={() => {
                if ((selected.body || selected.subject) && !window.confirm('用基本正文替换当前主题和正文？')) return
                update(applicationTemplate(snapshot!.sender!.name, selected.company, selected.role))
              }}>填入基本正文</button></div>
              <label className="mail-label">主题<input className="mail-input" maxLength={200} placeholder="按招聘页要求填写，例如：应聘前端开发-姓名" value={selected.subject} onChange={e => update({ subject: e.target.value })} /></label>
              <label className="mail-label mt-3">正文<textarea className="mail-input min-h-[180px] resize-y leading-[1.8]" maxLength={12000} placeholder="说明应聘岗位，可补充一两句与岗位相关的经历。" value={selected.body} onChange={e => update({ body: e.target.value })} /></label>
            </div>
          </div> : <JobDetails job={selected as MailJob} disabled={busy || !!snapshot?.running} onAction={(action) => void run(() => jobAction(selected as MailJob, action))} />}
        </section>
      </div>
    </main>
    {settingsOpen && <MailSettings agent={agent} onClose={() => setSettingsOpen(false)} />}
    {preview && <MailPreview batch={preview} onClose={() => setPreview(null)} onSend={async batch => {
      await agent.command('/batches', batch)
      setDrafts(items => items.filter(item => !batch.jobs.some(job => job.id === item.id)))
      setPreview(null); setTab('history'); setSelectedId(batch.jobs[0].id); setError('')
    }} />}
  </WorkbenchFrame>
}

function JobDetails({ job, disabled, onAction }: { job: MailJob; disabled: boolean; onAction: (action: 'retry' | 'cancel' | 'confirm-sent') => void }) {
  return <article className="mx-auto max-w-[860px] p-5 text-[13px] sm:p-6">
    <div className="flex flex-wrap items-baseline gap-3"><h2 className="m-0 text-[17px] font-semibold">{job.company} / {job.role}</h2><span className="text-[12px] text-text-secondary">{MAIL_STATUS_LABELS[job.status]}</span></div>
    <p className="mb-5 text-[12px] leading-relaxed text-text-tertiary">{job.detail ?? '按清单顺序发送。'}<br />更新于 {new Date(job.updatedAt).toLocaleString('zh-CN')}</p>
    <dl className="mail-record grid grid-cols-[60px_minmax(0,1fr)] gap-x-3 gap-y-3 border-y border-line py-4 text-[12px]">
      <dt>发件人</dt><dd>{job.sender.name} &lt;{job.sender.address}&gt;</dd><dt>收件人</dt><dd>{job.recipient}</dd>
      <dt>官网来源</dt><dd><a href={safeLink(job.sourceUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">{job.sourceUrl}<ExternalLink size={12} className="shrink-0" /></a></dd>
      <dt>附件</dt><dd>{job.attachment.name} · {Math.max(1, Math.ceil(job.attachment.size / 1024))} KB</dd>
      <dt>邮件编号</dt><dd className="font-mono text-[11px]">{job.messageId}</dd>
    </dl>
    <h3 className="mb-3 mt-5 text-[14px] font-medium">{job.subject}</h3><div className="whitespace-pre-wrap break-words leading-[1.9] text-text-secondary">{job.body}</div>
    {['queued', 'failed', 'uncertain'].includes(job.status) && <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
      {job.status === 'failed' && <Button disabled={disabled} variant="secondary" onClick={() => onAction('retry')}>重新加入队列</Button>}
      {job.status === 'uncertain' && <Button disabled={disabled} variant="secondary" onClick={() => onAction('confirm-sent')}>已核对，标记为已发送</Button>}
      <Button disabled={disabled} variant="ghost" onClick={() => onAction('cancel')}>取消本条</Button>
    </div>}
  </article>
}
