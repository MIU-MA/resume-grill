import { expect, it } from 'vitest'
import { resumeKeywordCoverage, resumeMetricQuestions } from './resume-keywords'
it('关键词按边界匹配，不把 JavaScript 当 Java，保留缺失技能', () => {
  const result = resumeKeywordCoverage('JavaScript React Go K8s', 'Java React TypeScript Golang Kubernetes')
  expect(result.find(row => row.category === '后端')?.missing).toContain('Java')
  expect(result.find(row => row.category === '后端')?.matched).toContain('Golang')
  expect(result.find(row => row.category === '前端')?.coverage).toBe(50)
  expect(result.find(row => row.category === '工程')?.coverage).toBe(100)
})
it('JD 未要求时不虚报零分；补充提示保留原行索引而非生成数字', () => {
  expect(resumeKeywordCoverage('React', '').every(row => row.coverage === null)).toBe(true)
  const text = '工作经历\n负责平台的接口优化与排查\n提升性能 30%'
  expect(resumeMetricQuestions(text)).toEqual([{ line: '负责平台的接口优化与排查', index: 1 }])
})
