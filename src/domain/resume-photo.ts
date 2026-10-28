export type ResumePhoto = { dataUrl: string; position: 'left' | 'right' }
export function sameResumePhoto(a?: ResumePhoto | null, b?: ResumePhoto | null) {
  return (a?.dataUrl ?? '') === (b?.dataUrl ?? '') && (!a?.dataUrl || a.position === b?.position)
}
