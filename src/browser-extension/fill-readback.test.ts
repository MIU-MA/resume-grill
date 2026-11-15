// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { fillApplication } from './form-filler'

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks() })
it('框架替换整段 DOM 后按唯一字段身份继续填写，并读回新节点', async () => {
  document.body.innerHTML = '<form><label>姓名<input id="name"></label><label>邮箱<input id="email" type="email"></label></form>'
  document.getElementById('name')!.addEventListener('change', () => {
    const form = document.querySelector('form')!, next = form.cloneNode(true) as HTMLFormElement
    form.replaceWith(next)
  })
  const result = await fillApplication({ name: '测试人', email: 'test@example.com' }, [], null)
  expect(document.getElementById('email')).toHaveProperty('value', 'test@example.com')
  expect(result.filled).toEqual(['姓名', '邮箱'])
  expect(result.missing).toEqual([])
})
it('字段替换后没有稳定身份或出现重复身份时不猜测新节点', async () => {
  document.body.innerHTML = '<form><label>姓名<input required></label><label>邮箱<input id="email" type="email" required></label></form>'
  document.querySelector('input')!.addEventListener('input', () => {
    document.querySelector('form')!.innerHTML = '<label>姓名<input required></label><label>邮箱<input id="email" type="email" required></label><label>邮箱<input id="email" type="email" required></label>'
  })
  const result = await fillApplication({ name: '测试人', email: 'test@example.com' }, [], null)
  expect(result.filled).toEqual([])
  expect([...document.querySelectorAll('input')].every(node => !node.value)).toBe(true)
  expect(result.missing.length).toBeGreaterThan(0)
})
it('填写期间经历内容发生冲突，剩余空项不会继续使用原匹配', async () => {
  document.body.innerHTML = '<fieldset><legend>工作经历 1</legend><label>公司<input id="company"></label><label>职位<input id="title"></label></fieldset>'
  document.getElementById('company')!.addEventListener('input', event => { (event.target as HTMLInputElement).value = '其他公司' })
  const result = await fillApplication({}, [], null, '', [{ id: 'one', kind: 'work', organization: '甲公司', title: '前端', start: '', end: '', description: '' }])
  expect(document.getElementById('title')).toHaveProperty('value', '')
  expect(result.filled).toEqual([])
  expect(result.missing.length).toBeGreaterThan(0)
})
it('延迟清空或新增必填问题后不能显示整页已填好', async () => {
  document.body.innerHTML = '<form><label>姓名<input></label></form>'
  document.querySelector('input')!.onchange = event => {
    setTimeout(() => {
      (event.target as HTMLInputElement).value = ''
      document.querySelector('form')!.insertAdjacentHTML('beforeend', '<label>工作地点<input required></label>')
    }, 200)
  }
  const result = await fillApplication({ name: '测试人' }, [], null)
  expect(result.filled).toEqual([])
  expect(result.missing.some(field => field.label.includes('未接受'))).toBe(true)
  expect(result.missing.some(field => field.label.includes('工作地点'))).toBe(true)
})
it('下拉选项在组件校验后被撤回时不报告成功', async () => {
  document.body.innerHTML = '<label>学历</label><div class="ant-select" aria-label="学历"><input role="combobox" aria-label="学历" aria-controls="degree"><span class="ant-select-selection-item"></span></div><div role="listbox" id="degree"><div role="option">本科</div></div>'
  document.querySelector<HTMLElement>('[role=option]')!.onclick = () => {
    document.querySelector('.ant-select-selection-item')!.textContent = '本科'
    setTimeout(() => { document.querySelector('.ant-select-selection-item')!.textContent = '' }, 200)
  }
  const result = await fillApplication({ degree: '本科' }, [], null)
  expect(result.filled).toEqual([])
  expect(result.missing.some(field => field.label.includes('未保留选项'))).toBe(true)
})
