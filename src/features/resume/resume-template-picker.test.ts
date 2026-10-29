// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ResumeTemplatePicker } from './ResumeTemplatePicker'
import { Dialog } from '@/components/ui/Dialog'
import { RESUME_TEMPLATES } from '@/domain/resume-template'

const state = vi.hoisted(() => ({ error: null as string | null, loading: false, retry: vi.fn() }))
vi.mock('./hooks/use-resume-pdf', () => ({ useResumePdf: (text: string, _source: string, enabled: boolean, template: string) => ({
  artifact: enabled && !state.loading && !state.error ? { file: new File([text], `${template}.pdf`), pageCount: 1 } : null,
  error: state.error, retry: state.retry,
}) }))
vi.mock('./PdfPages', () => ({ PdfPages: ({ file }: { file: File }) => createElement('p', {}, file.name) }))
let host: HTMLDivElement, root: Root
const click = async (selector: string) => { await act(async () => host.querySelector<HTMLButtonElement>(selector)!.click()) }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  state.error = null; state.loading = false; state.retry.mockClear()
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })

it('逐个预览所有模板都使用当前正文；取消不改稿，只有确认后才应用', async () => {
  const change = vi.fn()
  await act(async () => root.render(createElement(ResumeTemplatePicker, { value: 'original', canUseOriginal: true, onChange: change, preview: { text: '林同学\n项目经历\n现有项目', sourceFile: '上传简历.pdf' } })))
  await click('[aria-label="更换简历模板"]')
  for (const template of RESUME_TEMPLATES) {
    await click(`[aria-label="预览${template.name}模板"]`)
    expect(host.querySelector('[aria-label="模板排版预览"]')!.textContent).toContain(`${template.id}.pdf`)
  }
  expect(change).not.toHaveBeenCalled()
  await click('[aria-label="关闭模板选择"]')
  expect(change).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(host.querySelector('[aria-label="更换简历模板"]'))
  await click('[aria-label="更换简历模板"]')
  await click('[aria-label="预览中文 Typst模板"]')
  await click('.resume-template-dialog-footer button:last-child')
  expect(change).toHaveBeenCalledExactlyOnceWith('typst')
  expect(host.querySelector('[aria-label="选择简历模板"]')).toBeNull()
})

it('无正文时八套完整样张都有实际文件，切换后显示对应大图', async () => {
  await act(async () => root.render(createElement(ResumeTemplatePicker, { value: 'classic', onChange: vi.fn() })))
  await click('[aria-label="更换简历模板"]')
  for (const template of RESUME_TEMPLATES) {
    await click(`[aria-label="预览${template.name}模板"]`)
    const image = host.querySelector<HTMLImageElement>('.resume-template-preview-pages > img')!
    expect(image.getAttribute('src')).toBe(`/resume-templates/${template.id}.preview.webp`)
    expect(existsSync(resolve('public', image.getAttribute('src')!.slice(1)))).toBe(true)
  }
})

it('生成失败提供重试且不能应用空白预览', async () => {
  state.error = '字体读取失败'
  await act(async () => root.render(createElement(ResumeTemplatePicker, { value: 'classic', onChange: vi.fn(), preview: { text: '真实简历正文', sourceFile: '简历.txt' } })))
  await click('[aria-label="更换简历模板"]')
  expect(host.querySelector('[role="alert"]')!.textContent).toContain('字体读取失败')
  expect(host.querySelector<HTMLButtonElement>('.resume-template-dialog-footer button:last-child')!.disabled).toBe(true)
  await click('.resume-template-preview-status button')
  expect(state.retry).toHaveBeenCalledOnce()
})

it('新建窗口中查看模板，Escape 只关闭模板，Tab 留在当前窗口', async () => {
  const closeParent = vi.fn()
  await act(async () => root.render(createElement(Dialog, { open: true, label: '新建简历', onClose: closeParent }, createElement(ResumeTemplatePicker, { value: 'classic', onChange: vi.fn() }))))
  await click('[aria-label="更换简历模板"]')
  const first = host.querySelector<HTMLButtonElement>('[aria-label="关闭模板选择"]')!
  const last = host.querySelector<HTMLButtonElement>('.resume-template-dialog-footer button:last-child')!
  last.focus()
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })))
  expect(document.activeElement).toBe(first)
  await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
  expect(host.querySelector('[aria-label="选择简历模板"]')).toBeNull()
  expect(closeParent).not.toHaveBeenCalled()
})
