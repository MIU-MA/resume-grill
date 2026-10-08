'use client'

import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { getPdfJs } from './lib/pdfjs'
import { RESUME_PAGE, type ResumePdfArtifact, type PdfTextBlock } from './lib/resume-pdf'

type Props = { file: File; artifact?: ResumePdfArtifact; disabled?: boolean; selectedStart?: number; changedRanges?: Array<{ start: number; end: number }>; onSelect?: (block: PdfTextBlock) => void }

export function PdfPages({ file, artifact, disabled, selectedStart, changedRanges, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const scrolled = useRef<number | undefined>(undefined)
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    let task: ReturnType<Awaited<ReturnType<typeof getPdfJs>>['getDocument']> | undefined
    setError('')
    setDocument(null)
    void Promise.all([getPdfJs(), file.arrayBuffer()]).then(([pdfjs, bytes]) => {
      if (!active) return
      task = pdfjs.getDocument({ data: bytes, cMapUrl: '/generated/cmaps/', cMapPacked: true, standardFontDataUrl: '/generated/standard_fonts/', wasmUrl: '/generated/wasm/' })
      return task.promise
    }).then(value => { if (active && value) setDocument(value) }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'PDF 无法显示。')
    })
    return () => { active = false; if (task) void task.destroy().catch(() => {}) }
  }, [file])
  useEffect(() => {
    if (selectedStart === undefined) { scrolled.current = undefined; return }
    if (!document || scrolled.current === selectedStart) return
    const target = container.current?.querySelector(`[data-resume-start="${selectedStart}"]`)
    if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); scrolled.current = selectedStart }
  }, [selectedStart, document])
  if (error) return <p role="alert" className="p-4 text-[12px] text-danger">{error}</p>
  if (!document) return <p role="status" className="p-4 text-[12px] text-text-tertiary">正在显示 PDF…</p>
  return <div ref={container} className="space-y-4">{Array.from({ length: document.numPages }, (_, index) => <PdfPage key={index} document={document} pageNumber={index + 1} blocks={artifact?.pages[index]?.blocks} disabled={disabled} selectedStart={selectedStart} changedRanges={changedRanges} onSelect={onSelect} />)}</div>
}

function PdfPage({ document, pageNumber, blocks, disabled, selectedStart, changedRanges, onSelect }: {
  document: PDFDocumentProxy; pageNumber: number; blocks?: PdfTextBlock[]; disabled?: boolean; selectedStart?: number; changedRanges?: Props['changedRanges']; onSelect?: Props['onSelect']
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [ratio, setRatio] = useState(RESUME_PAGE.width / RESUME_PAGE.height)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined
    void document.getPage(pageNumber).then(page => {
      if (!active || !canvas.current) return
      const viewport = page.getViewport({ scale: 1.5 })
      setRatio(viewport.width / viewport.height)
      canvas.current.width = Math.ceil(viewport.width)
      canvas.current.height = Math.ceil(viewport.height)
      task = page.render({ canvas: canvas.current, viewport })
      return task.promise
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : '页面显示失败。')
    })
    return () => { active = false; task?.cancel() }
  }, [document, pageNumber])
  return <div>
    <div className="relative mx-auto w-full max-w-[794px] border border-line-strong bg-white" style={{ aspectRatio: ratio }}>
      <canvas ref={canvas} className="block h-full w-full" aria-label={`简历 PDF 第 ${pageNumber} 页`} />
      {blocks?.filter(block => block.kind !== 'blank').map((block, index) => <button key={`${block.start}-${block.top}`} type="button" aria-label={`修改第 ${pageNumber} 页第 ${index + 1} 段`} title="点击修改这段" disabled={disabled} data-resume-start={block.start} onClick={() => onSelect?.(block)} className={`absolute border text-left hover:border-brand hover:bg-brand/10 focus:border-brand focus:outline-brand ${selectedStart === block.start ? 'border-brand bg-brand/10' : changedRanges?.some(range => range.start < block.end && range.end > block.start) ? 'border-brand/30 bg-brand/5' : 'border-transparent'}`} style={{ left: `${RESUME_PAGE.margin / RESUME_PAGE.width * 100}%`, width: `${(RESUME_PAGE.width - RESUME_PAGE.margin * 2) / RESUME_PAGE.width * 100}%`, top: `${block.top / RESUME_PAGE.height * 100}%`, height: `${block.height / RESUME_PAGE.height * 100}%` }} />)}
    </div>
    {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
    <p className="mb-0 mt-2 text-center text-[11px] text-text-tertiary">{pageNumber} / {document.numPages}</p>
  </div>
}
