// @vitest-environment jsdom
import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { parseResumeStructure } from '@/domain/resume-structure'
import { ResumeCandidateList } from './ResumeCandidateList'
import { ResumeReviewSidebar } from './ResumeReviewSidebar'
import { createReviewCandidates, groupCandidates, includeReviewLine } from './resume-review-utils'

it('缓存只有技能时仍能导航到其他章节、查看原文并手动补充练习', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const text = '技术能力\n前端：React、TypeScript\n项目经历\n订单模块：使用 React 实现筛选、分页与异常处理。\n实习经历\n需求与接口联调\n教育背景\n示例大学 本科'
  const sections = parseResumeStructure(text)
  const jump = vi.fn()
  function Fixture() {
    const [candidates, setCandidates] = useState(() => createReviewCandidates(text).filter(item => item.sourceSection === '技术能力'))
    return createElement('div', {},
      createElement(ResumeReviewSidebar, { sections, onSectionClick: jump }),
      createElement(ResumeCandidateList, { sections, candidates, groupedCandidates: groupCandidates(candidates, sections), editingId: null, analyzing: false, onSetEditing: vi.fn(), onUpdate: vi.fn(), onMergeWithNext: vi.fn(), onDelete: vi.fn(), onAdd: (title, line) => setCandidates(current => includeReviewLine(current, sections.find(section => section.title === title)!, line)) }))
  }
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(createElement(Fixture)))
    expect([...host.querySelectorAll('nav button')].map(button => button.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('项目经历'), expect.stringContaining('实习经历'), expect.stringContaining('教育背景')]))
    const project = host.querySelector('#resume-section-1')!.parentElement!
    expect(project.querySelector('details')!.open).toBe(true)
    expect(project.textContent).toContain('订单模块')
    await act(async () => [...host.querySelectorAll<HTMLButtonElement>('nav button')].find(button => button.textContent?.includes('项目经历'))!.click())
    expect(jump).toHaveBeenCalledWith(1)
    await act(async () => [...project.querySelectorAll('button')].find(button => button.textContent === '加入练习')!.click())
    expect(project.querySelector('input[type=checkbox]')).not.toBeNull()
    expect(host.querySelectorAll('input[type=checkbox]')).toHaveLength(2)
  } finally { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() }
})
