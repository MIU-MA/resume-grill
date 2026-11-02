'use client'

import { useEffect, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { useSessionState } from '@/hooks/use-session-state'
import { getPdfJs } from './lib/pdfjs'
import { RESUME_PAGE, type ResumePdfArtifact, type PdfTextBlock } from './lib/resume-pdf'

const MIN_ZOOM = 25
const MAX_ZOOM = 300

type Props = { file: File; artifact?: ResumePdfArtifact; disabled?: boolean; selectedStart?: number; changedRanges?: Array<{ start: number; end: number }>; onSelect?: (block: PdfTextBlock) => void }

export function PdfPages({ file, artifact, disabled, selectedStart, changedRanges, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const scrolled = useRef<number | undefined>(undefined)
  const [zoom, setZoom] = useSessionState('resume-pdf-zoom', 100, (value): value is number => typeof value === 'number' && value >= MIN_ZOOM && value <= MAX_ZOOM)
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
  useEffect(() => {
    const element = container.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      setZoom(current => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, current + (event.deltaY < 0 ? 10 : -10))))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [setZoom])
  if (error) return <p role="alert" className="p-4 text-body text-danger">{error}</p>
  if (!document) return <p role="status" className="p-4 text-meta text-text-tertiary">正在显示 PDF…</p>
  const changeZoom = (next: number) => setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next)))
  return <div className="flex min-h-0 flex-col">
    <div className="sticky top-0 z-10 flex flex-none items-center gap-1 border-b border-line bg-surface-soft/95 px-1 py-1.5 backdrop-blur" role="toolbar" aria-label="简历预览缩放">
      <button type="button" className="grid size-7 place-items-center text-text-secondary hover:bg-surface-hover disabled:opacity-40" aria-label="缩小简历预览" disabled={zoom <= MIN_ZOOM} onClick={() => changeZoom(zoom - 10)}><Minus size={14} /></button>
      <span className="w-12 text-center text-meta tabular-nums text-text-secondary" aria-live="polite">{zoom}%</span>
      <button type="button" className="grid size-7 place-items-center text-text-secondary hover:bg-surface-hover disabled:opacity-40" aria-label="放大简历预览" disabled={zoom >= MAX_ZOOM} onClick={() => changeZoom(zoom + 10)}><Plus size={14} /></button>
      <button type="button" className="ml-1 h-7 px-2 text-label text-text-secondary hover:bg-surface-hover disabled:opacity-40" disabled={zoom === 100} onClick={() => setZoom(100)}>适应宽度</button>
    </div>
    <div ref={container} className="min-h-0 flex-1 space-y-4 overflow-auto p-1">
      {Array.from({ length: document.numPages }, (_, index) => <PdfPage key={index} document={document} pageNumber={index + 1} layout={artifact?.pages[index]} disabled={disabled} selectedStart={selectedStart} changedRanges={changedRanges} onSelect={onSelect} zoom={zoom} />)}
    </div>
  </div>
}

function PdfPage({ document, pageNumber, layout, disabled, selectedStart, changedRanges, onSelect, zoom }: {
  document: PDFDocumentProxy; pageNumber: number; layout?: ResumePdfArtifact['pages'][number]; disabled?: boolean; selectedStart?: number; changedRanges?: Props['changedRanges']; onSelect?: Props['onSelect']; zoom: number
}) {
  const pageWidth = layout?.width ?? RESUME_PAGE.width, pageHeight = layout?.height ?? RESUME_PAGE.height
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
    <div className="relative mx-auto border border-line-strong bg-white" style={{ aspectRatio: ratio, width: `calc(min(100%, 794px) * ${zoom / 100})` }}>
      <canvas ref={canvas} className="block h-full w-full" aria-label={`简历 PDF 第 ${pageNumber} 页`} />
      {layout?.blocks.filter(block => block.kind !== 'blank').map((block, index) => <button key={`${block.start}-${block.top}`} type="button" aria-label={`修改第 ${pageNumber} 页第 ${index + 1} 段`} title="点击修改这段" disabled={disabled} data-resume-start={block.start} onClick={() => onSelect?.(block)} className={`absolute border text-left hover:border-brand hover:bg-brand/10 focus:border-brand focus:outline-brand ${selectedStart === block.start ? 'border-brand bg-brand/10' : changedRanges?.some(range => range.start < block.end && range.end > block.start) ? 'border-brand/30 bg-brand/5' : 'border-transparent'}`} style={{ left: `${(block.left ?? RESUME_PAGE.margin) / pageWidth * 100}%`, width: `${(block.width ?? pageWidth - RESUME_PAGE.margin * 2) / pageWidth * 100}%`, top: `${block.top / pageHeight * 100}%`, height: `${block.height / pageHeight * 100}%` }} />)}
    </div>
    {error && <p role="alert" className="text-body text-danger">{error}</p>}
    <p className="mb-0 mt-2 text-center text-meta text-text-tertiary">{pageNumber} / {document.numPages}</p>
  </div>
}
