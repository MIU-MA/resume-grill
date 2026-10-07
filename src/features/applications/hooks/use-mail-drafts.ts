'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { MailSender } from '@/domain/mail-schema'
import { listResumeAttachments } from '@/features/resume/lib/resume-library'
import { applyMailDefaults, initialMailDefaults, restoreMailDefaults, type MailDefaults } from '../mail-defaults'
import { validResumeAttachment, type Draft, type SavedJobPreparation, type WebsiteApplication } from '../draft-state'
import { createDraftWriter, loadMailDrafts, type AttachmentSource, type LibraryAttachment } from '../mail-draft-storage'

const VIEW_KEY = 'mail-workbench:view'

export function useMailDrafts(setError: Dispatch<SetStateAction<string>>, sender?: MailSender | null) {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [defaults, setDefaults] = useState<MailDefaults>(initialMailDefaults)
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([])
  const [attachment, setAttachment] = useState<File | null>(null)
  const [attachmentSource, setAttachmentSource] = useState<AttachmentSource>()
  const [libraryAttachments, setLibraryAttachments] = useState<LibraryAttachment[]>([])
  const [libraryError, setLibraryError] = useState(false)
  const [websiteApplications, setWebsiteApplications] = useState<WebsiteApplication[]>([])
  const [preparationByJob, setPreparationByJob] = useState<Record<string, SavedJobPreparation>>({})
  const [hydrated, setHydrated] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'drafts' | 'history'>('drafts')
  const [persist] = useState(() => createDraftWriter())

  useEffect(() => {
    if (hydrated) setDrafts(current => applyMailDefaults(current, defaults, sender))
  }, [sender, drafts, defaults, hydrated])

  useEffect(() => {
    setSelectedDraftIds(current => current.some(id => !drafts.some(draft => draft.id === id)) ? current.filter(id => drafts.some(draft => draft.id === id)) : current)
  }, [drafts])

  useEffect(() => {
    let active = true
    void Promise.allSettled([loadMailDrafts(), listResumeAttachments()]).then(([savedResult, libraryResult]) => {
      if (!active) return
      if (savedResult.status === 'rejected') { setError('无法读取浏览器中的投递草稿，请检查浏览器存储权限后刷新。'); return }
      const saved = savedResult.value
      try {
        const view = JSON.parse(window.sessionStorage.getItem(VIEW_KEY) ?? 'null')
        if (view?.tab === 'drafts' || view?.tab === 'history') setTab(view.tab)
        if (typeof view?.selectedId === 'string') setSelectedId(view.selectedId)
      } catch { /* Selection is optional; drafts remain in IndexedDB. */ }
      const library = libraryResult.status === 'fulfilled' ? libraryResult.value.filter(item => validResumeAttachment(item.file)) : []
      setLibraryError(libraryResult.status === 'rejected')
      setLibraryAttachments(library)
      if (saved) {
        setDrafts(saved.drafts); setWebsiteApplications(saved.websiteApplications ?? []); setPreparationByJob(saved.preparationByJob ?? {})
        setDefaults(restoreMailDefaults(saved.defaults))
        setSelectedDraftIds(saved.selectedIds ?? saved.drafts.map(draft => draft.id))
      }
      if (saved?.attachment) {
        if (validResumeAttachment(saved.attachment)) { setAttachment(saved.attachment); setAttachmentSource(saved.attachmentSource) }
        else setError('原先选择的附件无法读取，请重新选择简历原文件。')
      } else {
        const current = library.find(item => item.current)
        if (current) { setAttachment(current.file); setAttachmentSource({ id: current.id, updatedAt: current.updatedAt }) }
      }
      setHydrated(true)
    })
    return () => { active = false }
  }, [setError])
  useEffect(() => {
    if (hydrated) void persist({ drafts, attachment, attachmentSource, websiteApplications, preparationByJob, defaults, selectedIds: selectedDraftIds }).catch(() => setError('草稿未能保存到浏览器，刷新前请备份填写内容。'))
  }, [drafts, attachment, attachmentSource, websiteApplications, preparationByJob, defaults, selectedDraftIds, hydrated, persist, setError])
  useEffect(() => {
    if (!hydrated) return
    try { window.sessionStorage.setItem(VIEW_KEY, JSON.stringify({ tab, selectedId })) } catch { /* Optional view state. */ }
  }, [hydrated, tab, selectedId])

  return {
    drafts, setDrafts,
    defaults, setDefaults,
    selectedDraftIds, setSelectedDraftIds,
    attachment, setAttachment,
    attachmentSource, setAttachmentSource,
    libraryAttachments, libraryError, hydrated,
    websiteApplications, setWebsiteApplications,
    preparationByJob, setPreparationByJob,
    selectedId, setSelectedId,
    tab, setTab,
    persist,
  }
}
