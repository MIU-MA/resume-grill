import { expect, it } from 'vitest'
import { parseResumeStructure } from '@/domain/resume-structure'
import { createReviewCandidates, groupCandidates, includeReviewLine } from './resume-review-utils'

const text = '技术能力\n前端：React、TypeScript\n项目经历\n订单模块：使用 React 实现筛选、分页与异常处理。\n实习经历\n需求与接口联调\n教育背景\n示例大学 本科'
it('旧草稿只有技能要点时仍展示项目、实习和教育原文，不改动旧选择', () => {
  const sections = parseResumeStructure(text)
  const cached = createReviewCandidates(text).filter(item => item.sourceSection === '技术能力').map(item => ({ ...item, content: '用户手改的技能描述', enabled: false }))
  const groups = groupCandidates(cached, sections)
  expect(groups.map(([title]) => title)).toEqual(['技术能力', '项目经历', '实习经历', '教育背景'])
  expect(groups[1][1]).toEqual([])
  expect(groups[0][1][0]).toMatchObject({ content: '用户手改的技能描述', enabled: false })
})
it('原文可手动加入练习，重复加入不生成重复项；个人信息与教育仍不自动转练习', () => {
  const sections = parseResumeStructure(text)
  const internship = sections.find(section => section.kind === 'internship')!
  const line = internship.lines[0]
  const candidates = includeReviewLine([], internship, line.lineNumber)
  expect(candidates[0]).toMatchObject({ sourceSection: '实习经历', content: line.text, enabled: true })
  expect(includeReviewLine(candidates, internship, line.lineNumber)).toHaveLength(1)
  const education = sections.find(section => section.kind === 'education')!
  expect(includeReviewLine([], education, education.lines[0].lineNumber)).toEqual([])
})
