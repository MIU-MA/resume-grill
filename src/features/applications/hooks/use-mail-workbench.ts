'use client'
import { useEffect, useRef, useState } from 'react'
import type { Mode } from '@/application/types'
import type { SettingsTab } from '@/features/workspace/AppShell'
import type { CareerDiscovery, CareerPage, MailBatch, MailJob } from '@/domain/mail-schema'
import type { JobPreparationIntent, JobPreparationRequest } from '@/domain/job-preparation'
import type { JobAssistantTools } from '@/domain/job-assistant'
import { prepareAssistantDrafts } from '../mail/lib/assistant-drafts'
import { useMailAgent } from './use-mail-agent'
import { useSessionState } from '@/hooks/use-session-state'
import { useConfirmation } from '@/hooks/use-confirmation'
import { useMailDrafts } from '../mail/hooks/use-mail-drafts'
import { createMailPreviewBatch } from '../mail/lib/mail-preview-batch'
import type { AttachmentSource } from '../mail/lib/mail-draft-storage'
import type { ResumeTemplateId } from '@/domain/resume-template'
import { savedDate } from '../mail/lib/mail-presentation'
import { useApplicationTracker } from '../history/hooks/use-application-tracker'
import { prepareQuickMail } from '../mail/lib/quick-mail'
import { applyMailDefaults } from '../mail/lib/mail-defaults'
import { parseContactList, planContactImports } from '../mail/lib/contact-import'
import { websiteTargets } from '../website/lib/website-automation'
import { careerUrlKey } from '../jobs/lib/pasted-career'
import { draftIssues, markWebsiteApplication, preparationAttachment, selectedMailDrafts, updateDraft, validResumeAttachment, websiteLinks, type Draft, type DraftField, type SavedJobPreparation } from '../mail/lib/draft-state'
import { buildApplicationEntries, type ApplicationEntry } from '../history/lib/application-entry'
import type { ManualApplication } from '@/domain/application-record'
import type { ApplicationRecordValues } from '../history/ApplicationRecordDialog'
type Args = {
  mode: 'jobs' | 'applications' | 'careers' | 'application-history'
  onNavigate: (mode: Mode) => void
  onPrepare: (request: JobPreparationRequest, intent: JobPreparationIntent) => Promise<void>
}

/**
 * State and actions for the applications workspace. The view only owns JSX.
 */
export function useMailWorkbench({ mode, onNavigate, onPrepare }: Args) {
  const agent = useMailAgent()
  const [error, setError] = useState('')
  const {
    drafts, setDrafts,
    defaults, setDefaults,
    selectedDraftIds, setSelectedDraftIds,
    attachment, setAttachment,
    attachmentSource, setAttachmentSource,
    libraryAttachments, libraryError, hydrated,
    websiteApplications, setWebsiteApplications,
    preparationByJob, setPreparationByJob,
    selectedId, setSelectedId,
    setTab: setStoredTab,
    persist,
  } = useMailDrafts(setError, agent.snapshot?.sender)
  const tab: 'drafts' | 'history' = mode === 'application-history' ? 'history' : 'drafts'
  const isCareers = mode === 'careers'
  const isJobs = mode === 'jobs'
  const setTab = (value: 'drafts' | 'history') => {
    setStoredTab(value)
    if (value === 'history') onNavigate('application-history')
    else if (mode === 'application-history') onNavigate('applications')
  }
  const [defaultsOpen, setDefaultsOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [inputMode, setInputMode] = useSessionState<'email' | 'contacts' | 'links'>('mail-input', 'email', (value): value is 'email' | 'contacts' | 'links' => typeof value === 'string' && ['email', 'contacts', 'links'].includes(value))
  const [editOpen, setEditOpen] = useState(false)
  const [showDossier, setShowDossier] = useState(false)
  const [recordDialog, setRecordDialog] = useState<{ mode: 'add' | 'edit'; entry?: ApplicationEntry } | null>(null)
  const confirmation = useConfirmation()
  const [undo, setUndo] = useState<Array<{ id: string; label: string; restore: () => void | Promise<void>; expires: number }>>([])
  const undoable = (label: string, restore: () => void | Promise<void>) => setUndo(items => [...items, { id: crypto.randomUUID(), label, restore, expires: Date.now() + 8000 }])
  useEffect(() => {
    if (!undo.length) return
    const timer = window.setTimeout(() => setUndo(items => items.filter(item => item.expires > Date.now())), Math.max(0, Math.min(...undo.map(item => item.expires)) - Date.now()))
    return () => window.clearTimeout(timer)
  }, [undo])
  const [previewPreparation, setPreviewPreparation] = useState<Record<string, SavedJobPreparation>>({})
  const [attachmentOpen, setAttachmentOpen] = useState(false)
  const [focusRequest, setFocusRequest] = useState<{ field: DraftField; time: number } | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('model')
  const openSettings = (tab: SettingsTab) => { setSettingsTab(tab); setSettingsOpen(true) }
  const [preview, setPreview] = useState<MailBatch | null>(null)
  const [busy, setBusy] = useState(false)
  const [websiteIds, setWebsiteIds] = useState<string[] | null>(null)
  const [websiteChoices, setWebsiteChoices] = useState<Record<string, string>>({})
  const [tailoring, setTailoring] = useState<{ draft: Draft; file: File; source?: AttachmentSource; initialTemplate?: ResumeTemplateId } | null>(null)
  const pendingTailoring = useRef<string | null>(null)
  const pendingPreview = useRef<string[] | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const pendingPreparation = useRef<{ id: string; intent: JobPreparationIntent } | null>(null)
  const snapshot = agent.snapshot
  const tracking = useApplicationTracker(snapshot, setError)
  const jobs = [...new Map([...tracking.tracker.mailJobs, ...(snapshot?.jobs ?? [])].map(job => [job.id, job])).values()]
  const entries = buildApplicationEntries({ jobs, websites: websiteApplications, manuals: tracking.tracker.manualApplications, hiddenJobIds: tracking.tracker.hiddenMailJobIds })
  const selectedEntry = tab === 'history' ? entries.find(entry => entry.id === selectedId) ?? entries[0] ?? null : null
  const selected = tab === 'drafts' ? drafts.find(item => item.id === selectedId) ?? drafts[0] : null
  const pending = jobs.filter(job => job.status === 'queued').length
  const selectedReadyDrafts = selectedMailDrafts(drafts, selectedDraftIds)
  const selectedWebsiteCount = websiteTargets(drafts.filter(draft => selectedDraftIds.includes(draft.id))).length
  const selectedPreparation = selected ? preparationByJob[selected.id] : undefined
  const selectedAttachment = preparationAttachment(selectedPreparation, attachment, attachmentSource)
  const selectedDescription = selected?.jobDescription ?? ''
  const startTailoring = (draft: Draft, pickedFile?: File) => {
    if (!draft.jobDescription?.trim()) { setError('先粘贴这个岗位的 JD。'); return }
    const saved = preparationByJob[draft.id]?.tailoredResume
    const file = pickedFile ?? saved?.sourceFile ?? attachment
    if (!file) { pendingTailoring.current = draft.id; fileInput.current?.click(); return }
    pendingTailoring.current = null
    setEditOpen(false); setTailoring({ draft: { ...draft }, file, source: pickedFile ? undefined : saved?.source ?? attachmentSource, initialTemplate: saved?.template })
  }
  const attachmentLabel = selectedAttachment.file
    ? `${selectedAttachment.saved ? selectedAttachment.use === 'mail' ? '发送附件' : selectedAttachment.use === 'preview' ? '邮件预览时附件' : '准备时附件' : '使用附件'}：${selectedAttachment.file.name}${selectedAttachment.source ? ` · ${savedDate(selectedAttachment.source.updatedAt)} 版本` : ''}`
    : '尚未选择简历，点击检查或准备时可直接选择原文件。'

  useEffect(() => {
    const input = fileInput.current
    const cancel = () => { pendingPreparation.current = null; pendingTailoring.current = null; pendingPreview.current = null }
    input?.addEventListener('cancel', cancel)
    return () => input?.removeEventListener('cancel', cancel)
  }, [])

  useEffect(() => {
    if (!snapshot) return
    const submitted = new Set(snapshot.jobs.map(job => job.id))
    setDrafts(current => current.some(item => submitted.has(item.id)) ? current.filter(item => !submitted.has(item.id)) : current)
  }, [snapshot, setDrafts])

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await work() } catch (e) { setError(e instanceof Error ? e.message : '操作失败') }
    finally { setBusy(false) }
  }
  const updateById = (id: string, change: Partial<Draft>) => {
    const target = drafts.find(draft => draft.id === id)
    if (!target || tab !== 'drafts') return
    setDrafts(items => items.map(item => item.id === id ? updateDraft(item, change) : item))
    if (change.sourceUrl !== undefined && change.sourceUrl !== target.sourceUrl) {
      setPreparationByJob(items => { const next = { ...items }; delete next[id]; return next })
    } else if (change.jobDescription !== undefined) {
      setPreparationByJob(items => items[id] ? { ...items, [id]: { ...items[id], jobDescription: change.jobDescription! } } : items)
    }
  }
  const update = (change: Partial<Draft>) => { if (selected) updateById(selected.id, change) }
  const prepareJob = async (intent: JobPreparationIntent, pickedFile?: File) => {
    if (!selected || !selectedDescription.trim()) return
    const file = pickedFile ?? selectedAttachment.file
    if (!file) { pendingPreparation.current = { id: selected.id, intent }; fileInput.current?.click(); return }
    pendingPreparation.current = null
    const request: JobPreparationRequest = {
      job: { id: selected.id, company: selected.company, role: selected.role, sourceUrl: selected.sourceUrl, jobDescription: selectedDescription.trim() },
      attachment: file, attachmentSource: pickedFile ? undefined : selectedAttachment.source,
    }
    const nextPreparation = { ...preparationByJob, [selected.id]: { ...preparationByJob[selected.id], jobDescription: request.job.jobDescription, attachment: request.attachment, attachmentSource: request.attachmentSource, attachmentUse: selectedAttachment.use } }
    await persist({ drafts, attachment: pickedFile ?? attachment, attachmentSource: pickedFile ? undefined : attachmentSource, websiteApplications, preparationByJob: nextPreparation, defaults, selectedIds: selectedDraftIds })
    setPreparationByJob(nextPreparation)
    await onPrepare(request, intent)
  }
  const addDraft = () => {
    if (drafts.length >= 20) { setError('每批最多 20 封，请先发送或移除当前草稿'); return }
    const draft: Draft = { id: crypto.randomUUID(), company: '', role: defaults.role, sourceUrl: '', recipient: '', subject: '', body: '', sourceConfirmed: false, automatic: true }
    setDrafts(items => [...items, draft]); setSelectedDraftIds(items => [...items, draft.id]); setSelectedId(draft.id); setTab('drafts'); setFocusRequest({ field: 'recipient', time: Date.now() }); setEditOpen(true); setError('')
  }
  const importContacts = (text: string) => {
    const result = planContactImports(parseContactList(text, defaults.role), drafts, 20 - drafts.length)
    const added: Draft[] = result.items.map(item => ({ ...item, id: crypto.randomUUID(), subject: '', body: '', sourceConfirmed: false, automatic: true }))
    setDrafts(items => [...items, ...applyMailDefaults(added, defaults, snapshot?.sender)])
    setSelectedDraftIds(items => [...items, ...added.map(item => item.id)])
    setTab('drafts'); setEditOpen(false); setError('')
    return `已添加 ${added.length} 个条目${result.duplicates ? `，跳过 ${result.duplicates} 个重复条目` : ''}。`
  }
  const removeDraft = (id: string) => {
    const draft = drafts.find(item => item.id === id)
    const preparation = preparationByJob[id]
    const wasSelected = selectedDraftIds.includes(id)
    if (!draft) return
    undoable('已移除草稿', () => { setDrafts(items => items.some(item => item.id === id) ? items : [...items, draft]); if (preparation) setPreparationByJob(items => ({ ...items, [id]: preparation })); if (wasSelected) setSelectedDraftIds(items => [...new Set([...items, id])]) })
    setDrafts(items => items.filter(item => item.id !== id))
    setSelectedDraftIds(items => items.filter(item => item !== id))
    if (selected?.id === id) setEditOpen(false)
    setPreparationByJob(items => { const next = { ...items }; delete next[id]; return next })
  }
  const preparePreview = async (targets = selectedReadyDrafts, currentDrafts = drafts, currentIds = selectedDraftIds, preparedResumes = preparationByJob, pickedFile?: File) => {
    if (!snapshot?.sender) { openSettings('mail'); return }
    if (!attachment && !pickedFile && targets.some(draft => !preparedResumes[draft.id]?.tailoredResume)) { pendingPreview.current = targets.map(draft => draft.id); fileInput.current?.click(); return }
    const previewFile = pickedFile ?? attachment
    const previewSource = pickedFile ? undefined : attachmentSource
    pendingPreview.current = null
    const { batch, captured } = await createMailPreviewBatch(targets, preparedResumes, previewFile, previewSource, snapshot.sender)
    const nextPreparation = { ...preparedResumes, ...captured }
    await persist({ drafts: currentDrafts, attachment: previewFile, attachmentSource: previewSource, websiteApplications, preparationByJob: nextPreparation, defaults, selectedIds: currentIds })
    setPreparationByJob(nextPreparation); setPreviewPreparation(captured); setPreview(batch)
  }
  const previewQuickMail = async (recipient: string, jobDescription = '') => {
    const next = prepareQuickMail(recipient, drafts, defaults, snapshot?.sender, jobDescription)
    const ids = [...new Set([...selectedDraftIds, next.draft.id])]
    await persist({ drafts: next.drafts, attachment, attachmentSource, websiteApplications, preparationByJob, defaults, selectedIds: ids })
    setDrafts(next.drafts); setSelectedDraftIds(ids); setSelectedId(next.draft.id)
    if (jobDescription.trim()) startTailoring(next.draft)
    else await preparePreview([next.draft], next.drafts, ids)
  }
  const jobAction = async (job: MailJob, action: 'retry' | 'cancel' | 'confirm-sent') => {
    if (job.status === 'uncertain' && !await confirmation.confirm({ title: '核对发送结果', message: action === 'confirm-sent' ? '请先检查邮箱发信记录。确认这封邮件已经发出后，工作台会将其标记为已发送。' : '取消本条不会撤回邮件。如需再次投递，请先核实上次发送结果。', confirmLabel: action === 'confirm-sent' ? '确认已经发出' : '取消本条' })) return
    await agent.command('/job', { id: job.id, action })
  }
  const selectItem = (item: Draft) => {
    setSelectedId(item.id)
    const website = websiteLinks(item).length > 0
    const issue = draftIssues(item).find(value => !website || ['company', 'role', 'sourceUrl'].includes(value.field))
    setFocusRequest(issue ? { field: issue.field, time: Date.now() } : null)
  }
  const openDraft = (id: string) => {
    const draft = drafts.find(item => item.id === id)
    if (!draft) return
    selectItem(draft); setShowDossier(false); setEditOpen(true)
  }
  const markApplied = async (draft: Draft, url: string) => {
    const record = markWebsiteApplication(draft, url, Date.now())
    const previousSubmission = tracking.tracker.submissions[draft.id]
    await tracking.capture({ [draft.id]: { jobDescription: draft.jobDescription ?? '', attachment: selectedAttachment.file ?? undefined, at: record.appliedAt, channel: 'website' } })
    setPreparationByJob(items => ({ ...items, [draft.id]: { ...items[draft.id], jobDescription: draft.jobDescription ?? '' } }))
    setWebsiteApplications(items => [...items, record]); setDrafts(items => items.filter(item => item.id !== draft.id))
    undoable('已登记官网申请', async () => { await tracking.restoreSubmission(draft.id, record.appliedAt, previousSubmission); setWebsiteApplications(items => items.filter(item => item.id !== record.id)); setDrafts(items => items.some(item => item.id === draft.id) ? items : [...items, draft]); setTab('drafts'); setSelectedId(draft.id) })
    setTab('history'); setSelectedId(record.id)
  }
  const deleteEntry = async (entry: ApplicationEntry) => {
    if (entry.kind === 'mail') {
      await tracking.hideJob(entry.id)
      undoable('已从投递记录隐藏', () => tracking.unhideJob(entry.id))
    } else if (entry.kind === 'website' && entry.website) {
      const record = entry.website
      setWebsiteApplications(items => items.filter(item => item.id !== entry.id))
      undoable('已删除投递记录', () => setWebsiteApplications(items => items.some(item => item.id === record.id) ? items : [...items, record]))
    } else if (entry.kind === 'manual' && entry.manual) {
      const record = entry.manual
      const progress = tracking.tracker.progress[entry.id]
      await tracking.removeManual(entry.id)
      undoable('已删除投递记录', () => tracking.restoreManual(record, progress))
    }
    if (selectedEntry?.id === entry.id) setSelectedId(null)
  }
  const saveRecord = async (values: ApplicationRecordValues) => {
    const { stage, ...input } = values
    const now = Date.now()
    const editing = recordDialog?.mode === 'edit' ? recordDialog.entry : undefined
    if (editing?.kind === 'website' && editing.website) {
      setWebsiteApplications(items => items.map(item => item.id === editing.id ? {
        ...item,
        company: input.company,
        role: input.role,
        recipient: input.contact,
        sourceUrl: input.sourceUrl || item.sourceUrl,
        applicationUrl: input.sourceUrl || item.applicationUrl,
        appliedAt: input.appliedAt,
      } : item))
      await tracking.saveProgress(editing.id, { stage })
    } else if (editing?.kind === 'manual' && editing.manual) {
      const record: ManualApplication = { ...editing.manual, ...input, updatedAt: now }
      await tracking.saveManual(record, stage)
    } else {
      const record: ManualApplication = { id: crypto.randomUUID(), ...input, createdAt: now, updatedAt: now }
      await tracking.saveManual(record, stage)
      setSelectedId(record.id)
    }
    setRecordDialog(null)
    setError('')
  }
  const assistantTools: JobAssistantTools = {
    connected: !!snapshot,
    disabled: busy || !!preview,
    slots: 20 - drafts.length,
    existingJobs: drafts.map(({ sourceUrl, role }) => ({ sourceUrl, role })),
    preferredResumeId: attachmentSource?.id,
    onConnect: () => openSettings('local'),
    onBusy: setBusy,
    discover: (url, keywords) => agent.request<CareerDiscovery>('/discover', { url, ...(keywords?.length ? { keywords } : {}) }),
    read: url => agent.request<CareerPage>('/extract', { url }),
    onImport: async (pages, resume) => {
      if (busy || preview) throw new Error('当前操作尚未完成，请稍后再加入清单。')
      const additions = prepareAssistantDrafts(pages, drafts, defaults, snapshot?.sender)
      if (!additions.length) return
      const file = validResumeAttachment(resume.attachment) ? resume.attachment : null
      const source = file ? { id: resume.id, updatedAt: resume.attachmentUpdatedAt ?? resume.updatedAt } : undefined
      if (drafts.length && attachment && (!source || attachmentSource?.id !== source.id || attachmentSource.updatedAt !== source.updatedAt)) {
        throw new Error('清单中已有使用其他简历的岗位。请先处理当前清单，或使用同一份简历查找。')
      }
      const nextDrafts = [...drafts, ...additions]
      const nextSelected = [...selectedDraftIds, ...additions.map(draft => draft.id)]
      setBusy(true)
      try {
        await persist({ drafts: nextDrafts, attachment: file, attachmentSource: source, websiteApplications, preparationByJob, defaults, selectedIds: nextSelected })
        setDrafts(nextDrafts); setSelectedDraftIds(nextSelected); setAttachment(file); setAttachmentSource(source)
        setTab('drafts'); setError('')
      } finally { setBusy(false) }
    },
  }
  const addCareerPage = (result: CareerPage) => {
    const id = crypto.randomUUID()
    const draft: Draft = { id, company: result.company ?? '', role: result.role || defaults.role, sourceUrl: result.url, recipient: result.recommendedEmail ?? '', subject: '', body: '', sourceConfirmed: false, automatic: true, extraction: result, jobDescription: result.jobDescription ?? '' }
    setDrafts(items => items.length >= 20 || items.some(item => { try { return careerUrlKey(item.sourceUrl) === careerUrlKey(result.url) && item.role === draft.role } catch { return false } }) ? items : [...items, draft])
    setSelectedDraftIds(items => [...items, id]); setSelectedId(id); setFocusRequest(null); setError('')
  }
  const returnWebsiteToDrafts = (entry: ApplicationEntry) => {
    const record = entry.website
    if (!record) return
    const { channel: _channel, applicationUrl: _url, appliedAt: _at, ...draft } = record
    setWebsiteApplications(items => items.filter(item => item.id !== entry.id))
    setDrafts(items => [...items, draft])
    setSelectedDraftIds(items => [...items, draft.id])
    setSelectedId(draft.id)
    setTab('drafts')
  }

  return {
    agent, error, setError, drafts, setDrafts, defaults, setDefaults, selectedDraftIds, setSelectedDraftIds,
    attachment, setAttachment, attachmentSource, setAttachmentSource, libraryAttachments, libraryError, hydrated,
    websiteApplications, setWebsiteApplications, preparationByJob, setPreparationByJob, selectedId, setSelectedId,
    setTab, persist, tab, isCareers, isJobs, defaultsOpen, setDefaultsOpen, addOpen, setAddOpen,
    inputMode, setInputMode, editOpen, setEditOpen, showDossier, setShowDossier, recordDialog, setRecordDialog,
    confirmation, undo, setUndo, undoable, previewPreparation, setPreviewPreparation, attachmentOpen, setAttachmentOpen,
    focusRequest, setFocusRequest, settingsOpen, setSettingsOpen, settingsTab, setSettingsTab, openSettings,
    preview, setPreview, busy, setBusy, websiteIds, setWebsiteIds, websiteChoices, setWebsiteChoices,
    tailoring, setTailoring, fileInput, pendingTailoring, pendingPreview, snapshot, tracking, jobs, entries,
    selectedEntry, selected, pending, selectedReadyDrafts, selectedWebsiteCount, selectedPreparation,
    selectedAttachment, selectedDescription, startTailoring, attachmentLabel, run, updateById, update,
    prepareJob, addDraft, importContacts, removeDraft, preparePreview, previewQuickMail, jobAction,
    selectItem, openDraft, markApplied, deleteEntry, saveRecord, assistantTools, addCareerPage, returnWebsiteToDrafts, pendingPreparation,
  }
}