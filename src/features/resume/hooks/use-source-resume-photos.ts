'use client'
import { useEffect, useState } from 'react'
import type { ResumePhoto } from '@/domain/resume-photo'
import { sourceResumePhotos } from '../lib/source-resume-photos'

export function useSourceResumePhotos(file?: File, knownPhoto?: ResumePhoto) {
  const [result, setResult] = useState<{ file?: File; photos: ResumePhoto[]; error: string }>({ photos: [], error: '' })
  const needed = !!file && /\.(pdf|docx)$/i.test(file.name) && !knownPhoto
  useEffect(() => {
    if (!file || !needed) return
    let active = true
    void sourceResumePhotos(file).then(photos => { if(active)setResult({file,photos,error:''}) }).catch(error => { if(active)setResult({file,photos:[],error:error instanceof Error?error.message:'图片读取失败，请手动上传。'}) })
    return () => { active=false }
  }, [file, needed])
  return { photos: knownPhoto ? [knownPhoto] : result.file===file?result.photos:[], loading: needed && result.file!==file, error: result.file===file?result.error:'' }
}
