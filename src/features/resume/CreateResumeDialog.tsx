'use client'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ResumeProfileFields } from './ResumeProfileFields'
import { ResumeExperienceFields } from './ResumeExperienceFields'
import { useSourceResumePhotos } from './hooks/use-source-resume-photos'
import { SourceResumePhotos } from './SourceResumePhotos'
import { ResumePhotoPicker } from './ResumePhotoPicker'
import { ResumeTemplatePicker } from './ResumeTemplatePicker'
import { composeResumeText, type ResumeComposition } from '@/domain/resume-composition'
import type { ResumePhoto } from '@/domain/resume-photo'
import { DEFAULT_RESUME_TEMPLATE, type ResumeTemplateId } from '@/domain/resume-template'
import { createComposedResume, loadResumeComposition } from './lib/resume-composition'
import type { ResumeDocument } from './lib/resume-library'

export function CreateResumeDialog({ source, onClose, onCreated }: { source?: ResumeDocument | null; onClose: () => void; onCreated: (document: ResumeDocument, warning?: string) => Promise<void> }) {
  const [value, setValue] = useState<ResumeComposition | null>(null)
  const [photo, setPhoto] = useState<ResumePhoto | null | undefined>(source?.photo)
  const [template, setTemplate] = useState<ResumeTemplateId>(source?.pdfTemplate && source.pdfTemplate !== 'original' ? source.pdfTemplate : DEFAULT_RESUME_TEMPLATE)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [photoReading, setPhotoReading] = useState(false)
  const sourcePhotos = useSourceResumePhotos(source?.originalFile, source?.photo)
  const selectedPhoto = photo === undefined && sourcePhotos.photos.length === 1 ? sourcePhotos.photos[0] : photo
  const needsPhotoChoice = sourcePhotos.loading || ((sourcePhotos.photos.length > 1 || !!sourcePhotos.error) && photo === undefined)
  const raw = source?.review?.rawText ?? source?.extracted.text ?? ''
  let previewText = ''
  try { if (value) previewText = composeResumeText(value) } catch { /* Incomplete fields can still browse sample layouts. */ }
  useEffect(() => {
    let active = true
    void loadResumeComposition(raw).then(data => { if (active) setValue(data) }).catch(() => { if (active) { setError('已有资料未能读取，可以手动补充。'); setValue({ profile: {}, experiences: [], summary: '', skills: '', extra: '' }) } })
    return () => { active = false }
  }, [raw])
  const close = () => { if (!busy) onClose() }
  return <Dialog open onClose={close} label="新建简历" panelClassName="flex max-h-[92dvh] w-[min(820px,calc(100vw-24px))] flex-col border border-line bg-white shadow-xl">
    <header className="flex flex-none items-start justify-between gap-4 border-b border-line px-6 py-4"><div><h2 className="font-semibold">新建简历</h2><p className="mt-1 text-[12px] text-text-secondary">{source ? '已带入当前简历和官网填写的资料，核对后生成新文件。' : '复用官网填写的资料和经历，补充内容后生成 PDF。'}</p></div><button type="button" aria-label="关闭新建简历" disabled={busy} onClick={close}><X size={18} /></button></header>
    {!value ? <p role="status" className="p-6">正在读取已有资料…</p> : <form className="flex min-h-0 flex-1 flex-col" onSubmit={event => {
      event.preventDefault(); if (busy || photoReading || needsPhotoChoice) return
      setBusy(true); setError('')
      void createComposedResume(value, template, selectedPhoto).then(({ document, reuseWarning }) => onCreated(document, reuseWarning)).catch(cause => setError(cause instanceof Error ? cause.message : '简历未能生成，请重试。')).finally(() => setBusy(false))
    }}>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 text-[13px]">
        <section><h3 className="mb-3 font-medium">个人资料</h3><div className="grid gap-3 sm:grid-cols-2"><ResumeProfileFields keys={['name', 'phone', 'email', 'city', 'github', 'portfolio']} profile={value.profile} disabled={busy} onChange={profile => setValue({ ...value, profile })} /></div><div className="mt-4"><SourceResumePhotos {...sourcePhotos} chosen={selectedPhoto} disabled={busy} onChange={setPhoto} /><ResumePhotoPicker photo={selectedPhoto} disabled={busy} onChange={setPhoto} onReadingChange={setPhotoReading} /></div>{needsPhotoChoice && !sourcePhotos.loading && <button type="button" onClick={() => setPhoto(null)} className="mt-2 text-[12px] underline">确认不放照片</button>}</section>
        <section className="border-t border-line pt-4"><h3 className="font-medium">教育、工作与项目经历</h3><ResumeExperienceFields items={value.experiences} disabled={busy} onChange={experiences => setValue({ ...value, experiences })} /></section>
        {(['summary', 'skills', 'extra'] as const).map(key => <label className="mail-label" key={key}>{{ summary: '个人简介', skills: '专业技能', extra: '其他内容（证书、奖项等）' }[key]}<textarea className="mail-input min-h-24" disabled={busy} maxLength={15000} value={value[key]} onChange={event => setValue({ ...value, [key]: event.target.value })} /></label>)}
        {raw && <details><summary className="cursor-pointer text-text-secondary">对照当前简历原文</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap bg-surface-soft p-3 font-sans">{raw}</pre></details>}
        <ResumeTemplatePicker value={template} disabled={busy} onChange={setTemplate} preview={{ text: previewText, sourceFile: '新建简历.pdf', photo: selectedPhoto }} />
      </div>
      <footer className="flex flex-none flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 sm:flex-nowrap"><div className="text-[12px] text-text-secondary max-sm:w-full">{error ? <span role="alert" className="text-danger">{error}</span> : '仅在本机排版。确认后的资料也可用于官网填写。'}</div><div className="ml-auto flex shrink-0 gap-3 whitespace-nowrap"><Button variant="ghost" disabled={busy} onClick={close}>取消</Button><Button type="submit" disabled={photoReading || needsPhotoChoice} loading={busy}>生成简历</Button></div></footer>
    </form>}
  </Dialog>
}
