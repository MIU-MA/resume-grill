'use client'
import { useRef, useState } from 'react'
import type { ResumePhoto } from '@/domain/resume-photo'
import { readResumePhoto } from './lib/resume-photo'

export function ResumePhotoPicker({ photo, disabled, onChange, onReadingChange }: { photo?: ResumePhoto | null; disabled?: boolean; onChange: (photo: ResumePhoto | null) => void; onReadingChange?: (reading: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState(''), [reading, setReading] = useState(false)
  return <div className="flex flex-wrap items-center gap-3 text-[12px] text-text-secondary">
    {photo && <img className="h-12 w-9 border border-line object-contain" src={photo.dataUrl} alt="简历照片" width={36} height={48} />}
    <button type="button" disabled={disabled || reading} onClick={() => input.current?.click()}>{reading ? '正在处理照片…' : photo ? '更换照片' : '上传照片'}</button>
    {photo && <><select aria-label="照片位置" disabled={disabled || reading} value={photo.position} onChange={event => onChange({ ...photo, position: event.target.value as ResumePhoto['position'] })}><option value="right">抬头右侧</option><option value="left">抬头左侧</option></select><button type="button" disabled={disabled || reading} onClick={() => onChange(null)}>移除照片</button></>}
    <input ref={input} aria-label="上传简历照片" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => {
      const file = event.target.files?.[0]; if (!file) return
      setReading(true); onReadingChange?.(true); setError('')
      void readResumePhoto(file).then(value => onChange({ ...value, position: photo?.position ?? 'right' })).catch(cause => setError(cause instanceof Error ? cause.message : '照片读取失败。')).finally(() => { setReading(false); onReadingChange?.(false); if (input.current) input.current.value = '' })
    }} />
    {error && <span role="alert" className="text-danger">{error}</span>}
  </div>
}
