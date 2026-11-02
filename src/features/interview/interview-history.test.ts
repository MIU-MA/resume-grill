// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { InterviewHistory } from './InterviewHistory'
import type { InterviewTurn } from './interview-view-types'
let host: HTMLDivElement, root: Root
const turn = (index: number): InterviewTurn => ({ action: 'answer', question: `问题${index}`, answer: `我的回答${index}`, intent: '检查理解', answerSuggestion: '参考回答' })
beforeEach(() => { vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); sessionStorage.clear(); host = document.createElement('div'); document.body.append(host); root = createRoot(host) })
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
it('默认展开全部问答，解释单独收起；追加问题不重置用户已收起的历史', async () => {
  await act(async () => root.render(createElement(InterviewHistory, { turns: [turn(1), turn(2)], strictMode: false, scope: 'resume-a' })))
  expect(host.textContent).toContain('我的回答1'); expect(host.textContent).toContain('我的回答2')
  expect([...host.querySelectorAll('details')].every(detail => !detail.open)).toBe(true)
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-expanded]')!.click())
  await act(async () => root.render(createElement(InterviewHistory, { turns: [turn(1), turn(2), turn(3)], strictMode: false, scope: 'resume-a' })))
  expect(host.textContent).not.toContain('我的回答1'); expect(host.textContent).toContain('我的回答2'); expect(host.textContent).toContain('我的回答3')
  await act(async () => root.unmount()); root = createRoot(host)
  await act(async () => root.render(createElement(InterviewHistory, { turns: [turn(1), turn(2), turn(3)], strictMode: false, scope: 'resume-a' })))
  expect(host.textContent).not.toContain('我的回答1')
  await act(async () => [...host.querySelectorAll('button')].find(button => button.textContent === '展开全部')!.click())
  expect(host.textContent).toContain('我的回答1')
})
