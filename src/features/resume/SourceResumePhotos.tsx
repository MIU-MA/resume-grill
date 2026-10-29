'use client'
import type { ResumePhoto } from '@/domain/resume-photo'
export function SourceResumePhotos({ photos, loading, error, chosen, onChange, disabled }: { photos: ResumePhoto[]; loading: boolean; error: string; chosen?: ResumePhoto | null; onChange: (photo: ResumePhoto | null) => void; disabled?: boolean }) {
  return <div className="text-[12px] text-text-secondary">
    {loading ? <p role="status">正在读取原文件中的图片…</p> : error ? <p role="alert">{error}</p> : photos.length>1 ? <div className="flex flex-wrap items-center gap-3"><span>选择要保留的照片</span>{photos.map((photo,index)=><button key={index} type="button" aria-label={`使用原文件图片 ${index+1}`} aria-pressed={chosen?.dataUrl===photo.dataUrl} disabled={disabled} className="border border-line p-1 aria-pressed:border-brand" onClick={()=>onChange(photo)}><img src={photo.dataUrl} alt={`原文件图片 ${index+1}`} className="h-16 w-12 object-contain" /></button>)}<button type="button" disabled={disabled} onClick={()=>onChange(null)}>不放照片</button></div> : photos.length===1 && chosen ? <span>已带入原文件图片，请核对下方缩略图。</span> : null}
  </div>
}
