'use client'

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

export const MIN_PDF_ZOOM = 25
export const MAX_PDF_ZOOM = 300
type Point = { x: number; y: number }
function setScroll(element: HTMLElement, left: number, top: number) {
  element.scrollLeft = Math.max(0, Math.min(element.scrollWidth - element.clientWidth, left))
  element.scrollTop = Math.max(0, Math.min(element.scrollHeight - element.clientHeight, top))
}
const typing = (target: EventTarget | null) => target instanceof Element && !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')

export function usePdfNavigation(container: RefObject<HTMLDivElement | null>, ready: boolean, zoom: number, setZoom: (value: number) => void) {
  const latest = useRef({ zoom, setZoom })
  const panning = useRef(false)
  const anchor = useRef<{ page: HTMLElement; fraction: Point; point: Point } | null>(null)
  const [hand, setHand] = useState(true)
  const [space, setSpace] = useState(false)
  const [dragging, setDragging] = useState(false)
  useLayoutEffect(() => { latest.current = { zoom, setZoom } })
  const changeZoom = (value: number, point?: Point) => {
    const element = container.current
    const next = Math.max(MIN_PDF_ZOOM, Math.min(MAX_PDF_ZOOM, value))
    if (!element || panning.current || next === latest.current.zoom) return
    const bounds = element.getBoundingClientRect()
    point ??= { x: bounds.left + Math.min(element.clientWidth, bounds.width) / 2, y: bounds.top + element.clientHeight / 2 }
    const pages = [...element.querySelectorAll<HTMLElement>('[data-pdf-page]')]
    const page = pages.find(page => { const rect = page.getBoundingClientRect(); return rect.top <= point.y && rect.bottom >= point.y }) ?? pages[0]
    if (page) {
      const rect = page.getBoundingClientRect()
      if (rect.width && rect.height) {
        const fraction = { x: (point.x - rect.left) / rect.width, y: (point.y - rect.top) / rect.height }
        anchor.current = { page, fraction, point }
      }
    }
    latest.current.zoom = next
    latest.current.setZoom(next)
  }
  const change = useRef(changeZoom)
  useLayoutEffect(() => { change.current = changeZoom })
  useLayoutEffect(() => {
    const target = anchor.current
    anchor.current = null
    if (!target?.page.isConnected) return
    const rect = target.page.getBoundingClientRect()
    const element = container.current
    if (!element) return
    setScroll(element, element.scrollLeft + rect.left + rect.width * target.fraction.x - target.point.x, element.scrollTop + rect.top + rect.height * target.fraction.y - target.point.y)
  }, [zoom, container])
  useEffect(() => {
    const element = container.current
    if (!ready || !element) return
    let hovered = false, held = false, suppressClick = false
    let drag: { id: number; point: Point; left: number; top: number } | null = null
    const stop = () => {
      if (drag && element.hasPointerCapture?.(drag.id)) element.releasePointerCapture(drag.id)
      drag = null; panning.current = false; setDragging(false)
    }
    const blur = () => { held = false; hovered = false; setSpace(false); stop() }
    const enter = () => { hovered = true }
    const leave = () => { hovered = false }
    const keydown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey || typing(event.target) || (!hovered && !element.contains(document.activeElement))) return
      event.preventDefault(); held = true; setSpace(true)
    }
    const keyup = (event: KeyboardEvent) => { if (event.code === 'Space') { held = false; setSpace(false); stop() } }
    const down = (event: PointerEvent) => {
      if (typing(event.target) || (event.button !== 1 && !(event.button === 0 && (held || hand)))) return
      if (event.button === 1 || held) { event.preventDefault(); event.stopPropagation() }
      panning.current = true; anchor.current = null
      drag = { id: event.pointerId, point: { x: event.clientX, y: event.clientY }, left: element.scrollLeft, top: element.scrollTop }
      suppressClick = event.button === 1 || held
      if (suppressClick) { setDragging(true); element.focus({ preventScroll: true }); element.setPointerCapture?.(event.pointerId) }
    }
    const move = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return
      if (!suppressClick && Math.hypot(event.clientX - drag.point.x, event.clientY - drag.point.y) < 4) return
      suppressClick = true; setDragging(true)
      if (!element.hasPointerCapture?.(event.pointerId)) element.setPointerCapture?.(event.pointerId)
      event.preventDefault()
      setScroll(element, drag.left - (event.clientX - drag.point.x), drag.top - (event.clientY - drag.point.y))
    }
    const up = (event: PointerEvent) => { if (drag?.id === event.pointerId) stop() }
    const click = (event: MouseEvent) => { if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false } }
    const resetClick = (event: PointerEvent) => { if (event.button === 0 && !held) suppressClick = false }
    const wheel = (event: WheelEvent) => {
      if (panning.current) {
        if (event.deltaX || event.deltaY) { event.preventDefault(); event.stopPropagation() }
        return
      }
      if ((!event.ctrlKey && !event.metaKey) || !event.deltaY) return
      event.preventDefault(); event.stopPropagation()
      change.current(latest.current.zoom + (event.deltaY < 0 ? 10 : -10), { x: event.clientX, y: event.clientY })
    }
    element.addEventListener('wheel', wheel, { passive: false })
    element.addEventListener('pointerenter', enter); element.addEventListener('pointerleave', leave)
    element.addEventListener('pointerdown', resetClick, true); element.addEventListener('pointerdown', down, true)
    element.addEventListener('click', click, true); element.addEventListener('auxclick', click, true)
    window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur)
    return () => {
      panning.current = false; anchor.current = null
      if (drag && element.hasPointerCapture?.(drag.id)) element.releasePointerCapture(drag.id)
      element.removeEventListener('wheel', wheel)
      element.removeEventListener('pointerenter', enter); element.removeEventListener('pointerleave', leave)
      element.removeEventListener('pointerdown', resetClick, true); element.removeEventListener('pointerdown', down, true)
      element.removeEventListener('click', click, true); element.removeEventListener('auxclick', click, true)
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur)
    }
  }, [container, ready, hand])
  return { changeZoom, hand, setHand, cursor: dragging ? 'grabbing' : space || hand ? 'grab' : undefined, dragging }
}
