import { expect, it } from 'vitest'
import { isGenericJobTitle, matchesJob, matchesJobTitle, searchKeywords, searchQueries } from './job-search'

it.each(['高级全栈工程师', '全端研发', 'Senior Full-stack Engineer', 'Full Stack Developer', 'Fullstack Engineer'])('全栈同时识别官网中的不同写法：%s', title => {
  expect(matchesJobTitle(title, ['全栈'])).toBe(true)
})
it.each(['前端工程师', '后端工程师', '产品经理', '负责全站运营'])('全栈不混入普通其他岗位：%s', title => {
  expect(matchesJobTitle(title, ['全栈'])).toBe(false)
})
it.each(['财务', '运营', '人力资源', '产品', '设计', '市场', '护士', '教师', '视频剪辑', '律师', '机械', '自定义岗位名'])('任意岗位名称均可作为关键词：%s', term => {
  expect(matchesJobTitle(`高级${term}`, [term])).toBe(true)
  expect(searchKeywords([term])).toContain(term)
})
it('英文输入也能找到中文全栈，空关键词不匹配全部岗位', () => {
  expect(matchesJobTitle('全栈开发', ['Full-stack'])).toBe(true)
  expect(matchesJobTitle('任意职位', [' '])).toBe(false)
  expect(matchesJobTitle('芯片销售', ['前端', '销售'])).toBe(true)
})

it.each([
  ['前端', 'Senior Front-end Engineer', '芯片前端工程师'],
  ['后端开发工程师', 'Backend Engineer', '前端开发'],
  ['全栈', 'Full-stack Developer', '全站运营'],
  ['产品经理', 'Product Manager', '产品运营'],
  ['产品运营', 'Product Operations', '产品经理'],
  ['财务', 'Finance Specialist', '销售'],
  ['会计', 'Senior Accountant', 'Account Manager'],
  ['人力资源', 'HR Specialist', 'Chrome Developer'],
  ['测试', 'QA Engineer', 'Quant Researcher'],
  ['运维', 'SRE Engineer', '产品经理'],
  ['数据分析', 'Data Analyst', '数据科学家'],
  ['交互设计', 'UX Designer', '产品经理'],
  ['机械', 'Mechanical Engineer', '销售'],
  ['护士', 'Registered Nurse', '教师'],
  ['教师', 'English Teacher', '律师'],
  ['视频剪辑', 'Video Editor', '代码编辑器开发'],
  ['供应链', 'Supply Chain Specialist', '法务'],
  ['养老护理', '高级养老护理', '软件工程师'],
])('%s 搜索跨名称匹配且排除其他方向', (query, wanted, unrelated) => {
  expect(matchesJobTitle(wanted, [query])).toBe(true)
  expect(matchesJobTitle(unrelated, [query])).toBe(false)
})
it('英文岗位名称反查中文；短缩写不匹配英文词的一部分', () => {
  expect(matchesJobTitle('后端研发', ['Backend Engineer'])).toBe(true)
  expect(matchesJobTitle('人事专员', ['HR'])).toBe(true)
  expect(matchesJobTitle('Governance Specialist', ['Go'])).toBe(false)
})
it('泛标题可以读取自身 JD，明确其他岗位不因协作要求混入', () => {
  expect(isGenericJobTitle('高级软件工程师')).toBe(true)
  expect(matchesJob('高级软件工程师', '负责全栈开发', ['全栈'])).toBe(true)
  expect(matchesJob('产品经理', '与全栈工程师合作', ['全栈'])).toBe(false)
})
it('多方向查询优先尝试各个原始方向，别名不会挤掉其他职业', () => {
  expect(searchQueries(['全栈', '财务', '教师', '律师'])).toEqual(['全栈', '财务', '教师', '律师', '全端', 'Finance'])
})
