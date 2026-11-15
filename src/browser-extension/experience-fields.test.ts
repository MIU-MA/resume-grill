// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { fillApplication } from './form-filler'
import type { WebsiteExperience } from '../domain/website-experience'

const items: WebsiteExperience[] = ['甲公司', '乙公司'].map((organization, i) => ({ id: String(i), kind: 'work', organization, title: '前端开发', start: '2023-01', end: '2024-02', description: `经历 ${i + 1}` }))
const group = (label: string, value = '') => `<fieldset><legend>${label}</legend><label>公司<input value="${value}"></label><label>职位<input></label><label>开始时间<input type="month"></label><label>工作内容<textarea></textarea></label></fieldset>`
afterEach(() => { document.body.replaceChildren() })
describe('多段经历按明确分组填写', () => {
  it('两段分别填写，不把统一资料复制到全部经历', async () => {
    document.body.innerHTML = group('工作经历 1') + group('工作经历 2')
    const result = await fillApplication({ company: '错误的统一公司' }, [], { name: 'resume.txt', base64: 'YQ==' }, '', items)
    expect([...document.querySelectorAll('fieldset')].map(row => row.querySelector('input')!.value)).toEqual(['甲公司', '乙公司'])
    expect([...document.querySelectorAll('textarea')].map(element => element.value)).toEqual(['经历 1', '经历 2'])
    expect(result.filled).toContain('工作经历 2 / 公司')
  })
  it('已有内容、缺少编号、重复编号都不猜测或覆盖', async () => {
    document.body.innerHTML = group('工作经历 1', '原有公司') + group('工作经历') + group('工作经历 2') + group('工作经历 2')
    const result = await fillApplication({ company: '统一公司' }, [], { name: 'resume.txt', base64: 'YQ==' }, '', items)
    expect([...document.querySelectorAll('fieldset')].map(row => row.querySelector('input')!.value)).toEqual(['原有公司', '', '', ''])
    expect(document.querySelector('textarea')!.value).toBe('')
    expect(result.missing.length).toBeGreaterThan(0)
  })
  it('官网缺少对应行时提示新增，不点击页面按钮', async () => {
    document.body.innerHTML = group('工作经历 1') + '<button>新增经历</button>'
    let clicked = false; document.querySelector('button')!.onclick = () => { clicked = true }
    const result = await fillApplication({}, [], { name: 'resume.txt', base64: 'YQ==' }, '', items)
    expect(result.missing.some(item => item.label.includes('还有 1 段未匹配'))).toBe(true)
    expect(clicked).toBe(false)
  })
  it('编号经历中的已有公司一致时补齐空项，再次执行不覆盖或重复填写', async () => {
    document.body.innerHTML = group('工作经历（1）', '甲公司') + group('工作经历 2', '乙公司')
    const first = await fillApplication({}, [], null, '', items)
    expect([...document.querySelectorAll('textarea')].map(node => node.value)).toEqual(['经历 1', '经历 2'])
    expect(first.missing).toEqual([])
    const next = await fillApplication({}, [], null, '', items)
    expect(next.filled).toEqual([])
    expect(next.missing).toEqual([])
  })
  it('无编号分组根据已有公司唯一匹配，不按页面顺序串用经历', async () => {
    document.body.innerHTML = group('工作经历', '乙公司') + group('工作经历', '甲公司')
    const result = await fillApplication({}, [], null, '', items)
    expect([...document.querySelectorAll('textarea')].map(node => node.value)).toEqual(['经历 2', '经历 1'])
    expect(result.missing).toEqual([])
  })
  it('组织相同而无法区分条目、或已有职位冲突时不拼接不同经历', async () => {
    document.body.innerHTML = group('工作经历', '甲公司')
    await fillApplication({}, [], null, '', [items[0], { ...items[1], organization: '甲公司' }])
    expect(document.querySelector('textarea')!.value).toBe('')
    document.body.innerHTML = group('工作经历 1', '甲公司')
    document.querySelectorAll('input')[1].value = '用户填写的其他职位'
    const result = await fillApplication({}, [], null, '', items)
    expect(document.querySelector('textarea')!.value).toBe('')
    expect(result.missing.some(field => field.label.includes('已有内容不同'))).toBe(true)
  })
})
