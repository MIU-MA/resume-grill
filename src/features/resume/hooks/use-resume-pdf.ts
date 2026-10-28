'use client'

import { useEffect, useState } from 'react'
import type { ResumePdfArtifact } from '../lib/resume-pdf'
import { createResumePdfRevision } from '../lib/resume-pdf-revision'
import { DEFAULT_RESUME_TEMPLATE, resumeTemplateId, type ResumeTemplateId } from '@/domain/resume-template'

export function useResumePdf(text: string, sourceFile: string, enabled = true, template: ResumeTemplateId = DEFAULT_RESUME_TEMPLATE, original?: File, baseText = text) {
  const [artifact, setArtifact] = useState<ResumePdfArtifact | null>(null)
  const [basis, setBasis] = useState<File | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const current = artifact?.inputText === text && artifact.sourceFile === sourceFile && resumeTemplateId(artifact.template) === template && enabled && (template !== 'original' || basis === original)
  useEffect(() => {
    if (!enabled) return
    let active = true
    setError(null)
    const timer = setTimeout(() => {
      void createResumePdfRevision(text, sourceFile, template, original, baseText).then(value => {
        if (active) { setArtifact(value); setBasis(original) }
      }).catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'PDF 预览生成失败，请重试。')
      })
    }, 350)
    return () => { active = false; clearTimeout(timer) }
  }, [text, sourceFile, enabled, attempt, template, original, baseText])
  return { artifact: current ? artifact : null, previous: artifact, loading: enabled && !current && !error, error, retry: () => setAttempt(value => value + 1) }
}
