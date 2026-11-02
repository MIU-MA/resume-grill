import { expect, it } from 'vitest'
import { matchesJobTitle, searchKeywords } from './job-search'

it.each(['高级全栈工程师', '全端研发', 'Senior Full-stack Engineer', 'Full Stack Developer', 'Fullstack Engineer'])('全栈同时识别官网中的不同写法：%s', title => {
  expect(matchesJobTitle(title, ['全栈'])).toBe(true)
})
it.each(['前端工程师', '后端工程师', '产品经理', '负责全站运营'])('全栈不混入普通其他岗位：%s', title => {
  expect(matchesJobTitle(title, ['全栈'])).toBe(false)
})
it.each(['财务', '运营', '人力资源', '产品', '设计', '市场', '护士', '教师', '视频剪辑', '律师', '机械', '自定义岗位名'])('任意岗位名称均可作为关键词：%s', term => {
  expect(matchesJobTitle(`高级${term}`, [term])).toBe(true)
  expect(searchKeywords([term])).toEqual([term])
})
it('英文输入也能找到中文全栈，空关键词不匹配全部岗位', () => {
  expect(matchesJobTitle('全栈开发', ['Full-stack'])).toBe(true)
  expect(matchesJobTitle('任意职位', [' '])).toBe(false)
  expect(matchesJobTitle('芯片销售', ['前端', '销售'])).toBe(true)
})
