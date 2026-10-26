'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { MailSender } from '@/domain/mail-schema'
import { PROFILE_LABELS, profileSchema, type WebsiteProfile, type WebsiteSnapshot } from '@/domain/website-automation'
import { loadResumeDocument } from '@/features/resume/lib/resume-library'
import { extensionRequest, loadWebsiteProfile, makeWebsiteBatch, saveWebsiteProfile, seedWebsiteProfile, websiteTargets } from './website-automation'
import { validResumeAttachment, type Draft } from './draft-state'
import { extractTextFromFile } from '@/features/resume/lib/pdf'
import { loadExperiences, saveExperiences, type ExperienceDraft } from './website-experience-storage'
import { WebsiteExperienceEditor } from './WebsiteExperienceEditor'

const labels = { pending: '待读取', opening: '打开页面中', filling: '填写中', waiting: '需处理', ready: '待核对提交', done: '已手动确认提交', skipped: '已跳过' }
export function WebsiteAutofillDialog({ drafts, attachment, resumeId, sender, initialUrls = {}, onClose }: { drafts: Draft[]; attachment: File | null; resumeId?: string; sender?: MailSender | null; initialUrls?: Record<string, string>; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [profile, setProfile] = useState<WebsiteProfile>({})
  const [selectedAttachment, setSelectedAttachment] = useState(attachment)
  const [urls, setUrls] = useState<Record<string, string>>(initialUrls)
  const [connected, setConnected] = useState(false)
  const [queue, setQueue] = useState<WebsiteSnapshot | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [experienceSource, setExperienceSource] = useState('')
  const [experienceDraft, setExperienceDraft] = useState<ExperienceDraft>({ items: [], confirmed: false })
  const targets = websiteTargets(drafts)
  const parsedProfile = profileSchema.safeParse(profile)
  const missingEntrances = targets.filter(({ draft, links }) => links.length > 1 && !links.some(link => link.url === urls[draft.id]))
  const unfinishedQueue = queue?.jobs.some(job => !['done', 'skipped'].includes(job.status))
  const blocker = !ready ? '正在读取已保存的资料…' : !connected ? '尚未连接扩展。安装或重新加载后，请刷新工作台。' : !validResumeAttachment(selectedAttachment) ? '请选择 5 MB 以内的 PDF、DOCX 或 TXT 简历附件。' : !targets.length ? '请先在投递清单勾选官网岗位，需要有公司、职位和 HTTPS 招聘链接；邮箱岗位走邮件投递。' : targets.length > 20 ? '每批最多 20 个官网岗位，请减少勾选数量。' : missingEntrances.length ? `请为 ${missingEntrances.map(item => item.draft.company).join('、')} 选择申请入口。` : !parsedProfile.success ? parsedProfile.error.issues[0]?.message : unfinishedQueue ? '扩展已有未结束的任务。请打开工具栏中的 Resume Grill，继续处理或清空上一批。' : ''
  useEffect(() => {
    dialog.current?.showModal()
    let active = true
    void Promise.all([loadWebsiteProfile(), resumeId ? loadResumeDocument(resumeId) : Promise.resolve(undefined)]).then(async ([saved, doc]) => {
      let source = doc?.extracted.text ?? ''
      if (attachment && validResumeAttachment(attachment)) {
        try { source = (await extractTextFromFile(attachment)).text }
        catch { if (active) setMessage('未能读取附件文字，可手动补充资料；附件仍可用于官网填写。') }
      }
      const initial = { ...seedWebsiteProfile(source, sender), ...saved }
      const experiences = await loadExperiences(source)
      if (active) {
        setExperienceSource(source); setExperienceDraft(experiences)
        // Inputs are editable while loading. Preserve every user edit, including
        // intentional empty values; an older extension batch is not this draft.
        setProfile(current => ({ ...initial, ...current }))
        setReady(true)
      }
      try {
        const snapshot = await extensionRequest<WebsiteSnapshot | null>('snapshot')
        if (active) { setConnected(true); setQueue(snapshot) }
      } catch { if (active) setConnected(false) }
    }).catch(() => { if (active) setError('填写资料未能读取，请检查浏览器存储。') })
    const timer = setInterval(() => { void extensionRequest<WebsiteSnapshot | null>('snapshot').then(snapshot => { if (active) { setConnected(true); setQueue(snapshot) } }).catch(() => { if (active) setConnected(false) }) }, 4000)
    return () => { active = false; clearInterval(timer) }
    // Snapshot the selected resume and sender when this dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const field = (key: keyof WebsiteProfile) => <label key={key} className="mail-label">{PROFILE_LABELS[key]}<span className="ml-1 font-normal text-text-tertiary">（选填）</span><input className="mail-input" disabled={busy} maxLength={200} aria-describedby="website-profile-help" aria-invalid={!parsedProfile.success && parsedProfile.error.issues.some(issue => issue.path[0] === key)} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} placeholder="留空时在官网补充" value={profile[key] ?? ''} onChange={event => { const value = event.currentTarget.value; setProfile(current => ({ ...current, [key]: value })) }} /></label>
  const chooseAttachment = async (file: File) => {
    if (!validResumeAttachment(file)) { setError('请选择 5 MB 以内的 PDF、DOCX 或 TXT 简历。'); return }
    setBusy(true); setError(''); setMessage(''); setSelectedAttachment(file)
    setExperienceSource(''); setExperienceDraft({ items: [], confirmed: false })
    try {
      const source = (await extractTextFromFile(file)).text
      const experiences = await loadExperiences(source)
      setExperienceSource(source); setExperienceDraft(experiences)
      setProfile(current => ({ ...seedWebsiteProfile(source, sender), ...current }))
    } catch { setMessage('附件已选择，但未能读取其中的文字。可手动补充资料，附件仍会交给扩展。') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} onCancel={event => { if (busy) event.preventDefault(); else onClose() }} aria-label="官网批量填写" className="mail-dialog resume-workbench w-[760px] max-w-[calc(100vw-24px)] border border-line-strong bg-surface p-0 text-text-primary backdrop:bg-black/30">
    <header className="flex items-center justify-between border-b border-line px-5 py-4"><h2 className="m-0 text-[16px] font-semibold">官网批量填写</h2><Button variant="ghost" className="size-8 p-0" aria-label="关闭官网填写" disabled={busy} onClick={onClose}><X size={17} /></Button></header>
    <div className="max-h-[72vh] space-y-4 overflow-y-auto p-5 text-[12px]">
      <p className="m-0 leading-relaxed text-text-secondary">在这里选择简历和岗位，发送到扩展后，再点击浏览器工具栏中的 Resume Grill → 开始填写。扩展不会自动点击官网的最终提交。</p>
      <details className="text-text-tertiary"><summary className="cursor-pointer">哪些内容可以自动填写</summary><p>可尝试填写基础资料、明确编号的经历，以及能精确匹配选项的单选下拉框。已补充常见表单组件和 B站经历分组规则；国内官网尚未完成登录后实测。日期选择、多级城市、远程搜索和新增经历行仍可能需要手动处理。上传结果以官网提示为准。</p></details>
      {!connected && <section className="border border-line bg-surface-soft p-3"><strong className="font-medium">首次使用：安装 Chrome / Edge 扩展</strong><ol className="my-2 space-y-1 pl-5"><li><a href="/generated/website-extension.zip" download className="text-accent underline">下载官网填写扩展</a>，解压到固定目录。</li><li>打开浏览器的扩展管理页，开启开发者模式，加载解压后的 <code>website-extension</code> 目录。</li><li>刷新工作台，再打开此面板。扩展固定到工具栏后，可随时查看进度。</li></ol><p className="mb-0 text-text-tertiary">只需安装一次；首次填写某个官网时，由扩展申请该站点的访问权限。</p></section>}
      <section className="border border-line p-3" aria-label="填写前的必选内容">
        <div className="flex items-center justify-between gap-3"><strong className="font-medium">简历附件 · 必选</strong><span className={connected ? 'text-success' : 'text-warning'}>{connected ? '扩展已连接' : '扩展未连接'}</span></div>
        <p className="my-2 break-all text-text-secondary">{selectedAttachment?.name ?? '尚未选择简历'}</p>
        <label className="mail-label">{selectedAttachment ? '更换简历附件' : '选择简历附件'}<input className="mail-input mt-1" type="file" accept=".pdf,.docx,.txt" disabled={busy || !ready} aria-required={!selectedAttachment} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void chooseAttachment(file) }} /></label>
        <p className="mb-0 mt-1 text-text-tertiary">PDF、DOCX 或 TXT，最大 5 MB。</p>
        <div className="mt-3 border-t border-line pt-3"><strong className="font-medium">官网岗位入口 · 必选 · 已选 {targets.length} 个</strong>
          {!targets.length && <p className="mb-0 text-warning">返回投递清单，勾选有公司、职位和 HTTPS 招聘链接的官网岗位。已填写收件邮箱的条目走邮件投递。</p>}
          {drafts.length > targets.length && <p className="text-text-tertiary">另有 {drafts.length - targets.length} 条是邮箱岗位或缺少公司、职位、有效官网链接，未加入本批。</p>}
          {targets.map(({ draft, links, url }) => <div key={draft.id} className="mt-2 border-t border-line pt-2"><span>{draft.company} / {draft.role}</span>{links.length > 1 ? <label className="mail-label mt-1">申请入口 · 必选<select className="mail-input mt-1" required disabled={busy} aria-label={`${draft.company} 申请入口`} value={urls[draft.id] ?? ''} onChange={event => setUrls(current => ({ ...current, [draft.id]: event.target.value }))}><option value="">请选择具体申请入口</option>{links.map(link => <option key={link.url} value={link.url}>{link.label || link.url}</option>)}</select></label> : <span className="ml-2 break-all text-text-tertiary">{new URL(url).hostname}{!links.length ? ' · 尚未识别具体表单，请在官网进入申请页后继续' : ''}</span>}</div>)}
        </div>
      </section>
      <section><strong className="font-medium">可复用的个人资料</strong><p id="website-profile-help" className="my-2 text-text-secondary">以下均可留空，建议先填写姓名、邮箱和手机号。各官网的必填项不同，扩展读取申请表后会列出缺项，再按提示补充。</p><div className="grid gap-3 sm:grid-cols-3">{field('name')}{field('email')}{field('phone')}</div></section>
      {ready && <WebsiteExperienceEditor draft={experienceDraft} source={experienceSource} disabled={busy} onChange={setExperienceDraft} onSave={() => saveExperiences(experienceSource, experienceDraft)} />}
      <details className="border-b border-line pb-3"><summary className="cursor-pointer text-text-secondary">其他个人资料</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">{(Object.keys(PROFILE_LABELS) as Array<keyof WebsiteProfile>).filter(key => !['name', 'email', 'phone'].includes(key)).map(field)}</div></details>
      {queue && <section className="border border-line p-3"><strong className="font-medium">扩展中的任务 · {queue.running ? '正在处理' : '进度已保存'}</strong><p className="my-1 text-text-tertiary">简历：{queue.attachmentName}。补充资料、继续填写、暂停或跳过，请打开浏览器工具栏中的扩展。</p><div className="mt-2 divide-y divide-line">{queue.jobs.map(job => <div key={job.id} className="py-2">
        <div className="flex gap-3"><span className="min-w-0 flex-1 break-words">{job.company} / {job.role}</span><span className={`shrink-0 ${job.status === 'waiting' ? 'text-warning' : 'text-text-secondary'}`}>{labels[job.status]}</span></div>
        {(job.detail || job.result?.message) && <p className="my-1 break-words text-text-tertiary">{job.detail || job.result?.message}</p>}
        {!!job.result?.missing.length && <details className="mt-1"><summary className="cursor-pointer text-warning">查看需要处理的 {job.result.missing.length} 项</summary><ul className="mb-0 space-y-1 pl-4 text-text-secondary">{job.result.missing.map((item, index) => <li key={`${item.kind}-${index}`}>{item.label}</li>)}</ul></details>}
      </div>)}</div></section>}
      {error && <p role="alert" className="m-0 text-danger">{error}</p>}{message && <p role="status" className="m-0 text-success">{message}</p>}
    </div>
    <footer className="border-t border-line bg-surface-soft px-5 py-3"><p id="website-blocker" role="status" className={`mb-3 mt-0 text-[12px] ${blocker ? 'text-warning' : 'text-text-secondary'}`}>{blocker || '发送后，请到浏览器工具栏中的 Resume Grill 点击“开始填写”。'}</p><div className="flex justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={onClose}>关闭</Button><Button loading={busy} disabled={!!blocker} aria-describedby="website-blocker" onClick={() => {
      setBusy(true); setError(''); setMessage('')
      void (async () => { await saveWebsiteProfile(profile); await saveExperiences(experienceSource, experienceDraft); const batch = await makeWebsiteBatch(drafts, urls, profile, selectedAttachment, experienceDraft.confirmed ? experienceDraft.items : []); const snapshot = await extensionRequest<WebsiteSnapshot>('stage', batch); setQueue(snapshot); setMessage('已发送到扩展。下一步：点击浏览器工具栏中的 Resume Grill → 开始填写，并允许访问本批招聘网站。') })().catch(cause => setError(cause instanceof Error ? cause.message : '同步失败，请重试。')).finally(() => setBusy(false))
    }}>发送到扩展</Button></div></footer>
  </dialog>
}
