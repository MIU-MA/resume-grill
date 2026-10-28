'use client'
import { PROFILE_LABELS, type WebsiteProfile } from '@/domain/website-automation'

export function ResumeProfileFields({ keys, profile, disabled, onChange, optional, invalidKeys = [], describedBy }: { keys: Array<keyof WebsiteProfile>; profile: WebsiteProfile; disabled?: boolean; onChange: (profile: WebsiteProfile) => void; optional?: boolean; invalidKeys?: Array<keyof WebsiteProfile>; describedBy?: string }) {
  return <>{keys.map(key => <label key={key} className="mail-label">{PROFILE_LABELS[key]}{optional && <span className="ml-1 font-normal text-text-tertiary">（选填）</span>}<input className="mail-input" disabled={disabled} maxLength={200} aria-describedby={describedBy} aria-invalid={invalidKeys.includes(key)} placeholder={optional ? '留空时在官网补充' : undefined} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} value={profile[key] ?? ''} onChange={event => onChange({ ...profile, [key]: event.target.value })} /></label>)}</>
}
