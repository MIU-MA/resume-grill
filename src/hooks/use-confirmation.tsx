'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'

type Request = { title: string; message: string; confirmLabel?: string }
export function useConfirmation() {
  const [request, setRequest] = useState<Request | null>(null)
  const resolve = useRef<((value: boolean) => void) | null>(null)
  useEffect(() => () => resolve.current?.(false), [])
  const finish = (value: boolean) => { resolve.current?.(value); resolve.current = null; setRequest(null) }
  const confirm = (next: Request) => new Promise<boolean>(done => { resolve.current?.(false); resolve.current = done; setRequest(next) })
  const dialog = request && <Dialog open onClose={() => finish(false)} label={request.title} panelClassName="w-[min(440px,calc(100%-32px))] border border-line bg-white p-5">
    <h2 className="mt-0 text-section font-semibold">{request.title}</h2><p className="whitespace-pre-line text-body leading-relaxed text-text-secondary">{request.message}</p>
    <div className="mt-5 flex justify-end gap-3"><Button variant="secondary" autoFocus onClick={() => finish(false)}>取消</Button><Button variant="danger" onClick={() => finish(true)}>{request.confirmLabel ?? '确认'}</Button></div>
  </Dialog>
  return { confirm, dialog }
}
