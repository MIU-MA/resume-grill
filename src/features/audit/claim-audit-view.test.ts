// @vitest-environment jsdom
import { act, createElement, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { ClaimAuditView } from './ClaimAuditView'
import type { ResumeClaim, ResumeAnalysis } from '@/domain/resume-schema'
vi.mock('./ClaimList', () => ({ ClaimList: ({ selectedIndex }: { selectedIndex: number }) => createElement('p', null, `列表索引 ${selectedIndex}`) }))
vi.mock('./ClaimDetail', () => ({ ClaimDetail: ({ claim }: { claim: ResumeClaim }) => createElement('p', null, `详情 ${claim.id}`) }))
const host = document.createElement('div')
let root = createRoot(host)
afterEach(async () => { await act(async () => root.unmount()); root = createRoot(host); vi.unstubAllGlobals() })
const props = (): ComponentProps<typeof ClaimAuditView> => ({
  analysis: { claims: [{ id: 'a', title: '经历一', capability: '接口设计' }, { id: 'b', title: '经历二', capability: '系统优化' }] } as ResumeAnalysis,
  selectedIndex: 99, preparedClaimIds: [], error: null, progressByClaim: {}, claimPriorityOverrides: {},
  onSelect: vi.fn(), onTogglePrepared: vi.fn(), onStartInterview: vi.fn(), canContinueInterview: false, interviewLoading: false, onReport: vi.fn(), onSetClaimsPriority: vi.fn(), onBatchTogglePrepared: vi.fn(),
})
it('索引越界时列表与详情一致回退到首项，选择器按原始索引切换内容', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const input = props()
  await act(async () => root.render(createElement(ClaimAuditView, input)))
  expect(host.textContent).toContain('详情 a'); expect(host.textContent).toContain('列表索引 0')
  const select = host.querySelector('select')!
  await act(async () => { select.value = '1'; select.dispatchEvent(new Event('change', { bubbles: true })) })
  expect(input.onSelect).toHaveBeenCalledWith(1)
})
it('空列表给出明确提示，不读取不存在的条目', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const input = props(); input.analysis = { ...input.analysis, claims: [] }
  await act(async () => root.render(createElement(ClaimAuditView, input)))
  expect(host.querySelector('[role=status]')!.textContent).toContain('还没有可练习')
})
