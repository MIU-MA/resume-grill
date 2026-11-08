'use client'
import { useRef, useState, type RefObject } from 'react'
import { Button } from '@/components/ui/Button'
export function ResumePasteInput({ draft, disabled, onImport }: { draft: RefObject<string>; disabled: boolean; onImport: (text: string) => void }) {
  const input = useRef<HTMLTextAreaElement>(null)
  const [available, setAvailable] = useState(!!draft.current.trim())
  return <><textarea ref={input} aria-label="粘贴简历文本" className="block h-[180px] w-full resize-y border border-line-strong bg-white p-4 text-label leading-[1.8] focus:border-brand" placeholder="直接粘贴简历文本…" defaultValue={draft.current} disabled={disabled} onChange={event => { draft.current = event.target.value; setAvailable(!!event.target.value.trim()) }} /><Button className="mt-3 w-full" disabled={disabled || !available} onClick={() => onImport(input.current?.value ?? draft.current)}>导入文本</Button></>
}
