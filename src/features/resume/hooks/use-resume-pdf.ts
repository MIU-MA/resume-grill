'use client'

import { useEffect, useState } from 'react'
import { createResumePdf, type ResumePdfArtifact } from '../lib/resume-pdf'

export function useResumePdf(text: string, sourceFile: string, enabled = true) {
  const [artifact, setArtifact] = useState<ResumePdfArtifact | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const current = artifact?.inputText === text && artifact.sourceFile === sourceFile && enabled
  useEffect(() => {
    if (!enabled) return
    let active = true
    setError(null)
    const timer = setTimeout(() => {
      void createResumePdf(text, sourceFile).then(value => {
        if (active) setArtifact(value)
      }).catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'PDF 预览生成失败，请重试。')
      })
    }, 350)
    return () => { active = false; clearTimeout(timer) }
  }, [text, sourceFile, enabled, attempt])
  return { artifact: current ? artifact : null, previous: artifact, loading: enabled && !current && !error, error, retry: () => setAttempt(value => value + 1) }
}
