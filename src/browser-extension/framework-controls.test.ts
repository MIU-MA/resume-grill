// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { fillApplication, profileKey } from './form-filler'
import { formLabel, formRequired } from './form-dom'
import { act, createElement, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { vi } from 'vitest'

const attachment = { name: 'resume.txt', base64: 'YQ==' }
afterEach(() => { document.body.replaceChildren(); document.title = '' })

describe('共用控件契约（不是某家公司实站认证）', () => {
  it('原生事件写入 React 受控状态，重新渲染后值仍保留', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    const host = document.createElement('div'); document.body.append(host)
    const root = createRoot(host)
    function ControlledForm() {
      const [name, setName] = useState('')
      const [renders, setRenders] = useState(0)
      return createElement('form', null,
        createElement('label', null, '姓名', createElement('input', { value: name, onChange: (event: React.ChangeEvent<HTMLInputElement>) => setName(event.currentTarget.value) })),
        createElement('output', null, name),
        createElement('button', { type: 'button', onClick: () => setRenders(renders + 1) }, String(renders)))
    }
    try {
      await act(async () => root.render(createElement(ControlledForm)))
      await act(async () => { await fillApplication({ name: '测试人' }, [], attachment) })
      await act(async () => host.querySelector('button')!.click())
      expect(host.querySelector('input')!.value).toBe('测试人')
      expect(host.querySelector('output')!.textContent).toBe('测试人')
    } finally { await act(async () => root.unmount()); vi.unstubAllGlobals() }
  })
  it('学校城市、公司描述和学历类型不使用同类名称代填', () => {
    for (const label of ['学校所在城市', '公司描述', '当前公司地址', '学历类型']) expect(profileKey(label)).toBeUndefined()
  })
  it.each([
    ['ant-form-item', 'ant-form-item-label', 'ant-form-item-required'],
    ['el-form-item is-required', 'el-form-item__label', ''],
    ['semi-form-field', 'semi-form-field-label', 'semi-form-field-label-required'],
    ['next-form-item', 'next-form-item-label', 'next-form-item-required'],
    ['arco-form-item', 'arco-form-item-label', 'arco-form-item-symbol'],
  ])('%s 外置标签优先于占位提示并识别必填', async (row, label, marker) => {
    document.body.innerHTML = `<form><div class="${row}"><div class="${label}"><label class="${marker}">姓名</label></div><div><input placeholder="请填写，不要填写邮箱"></div></div></form>`
    const input = document.querySelector('input')!
    expect(formLabel(input)).toBe('姓名'); expect(formRequired(input)).toBe(true)
    const result = await fillApplication({ name: '测试人', email: 'test@example.com' }, [], attachment)
    expect(input.value).toBe('测试人'); expect(result.filled).toEqual(['姓名'])
  })
  it('原生下拉选项文字不污染标签，隐藏区域不会写入', async () => {
    document.body.innerHTML = '<form><label>最高学历<select><option value="">请选择邮箱</option><option>本科</option></select></label><details><summary>其他</summary><label>姓名<input></label></details><label>移动电话<input placeholder="请输入"></label></form>'
    const result = await fillApplication({ name: '测试人', degree: '本科', phone: '13800138000' }, [], attachment)
    expect(document.querySelector('select')!.value).toBe('本科')
    expect(document.querySelector('details input')).toHaveProperty('value', '')
    expect(result.filled).toEqual(['最高学历', '移动电话'])
  })
  it('框架校验报错、已有无效值和日期组件不会被报告成功', async () => {
    document.body.innerHTML = '<form><div class="ant-form-item"><div class="ant-form-item-label">姓名</div><input></div><label>邮箱<input type="email" value="bad-email" required></label><label>入学时间<span class="ant-picker"><input></span></label></form>'
    document.querySelector('input')!.addEventListener('focusout', event => (event.target as Element).setAttribute('aria-invalid', 'true'))
    const result = await fillApplication({ name: '测试人', educationStart: '2020-09' }, [], attachment)
    expect(result.filled).toEqual([])
    expect(result.missing.map(field => field.label).join(' ')).toMatch(/未接受.*|已有内容/)
    expect(result.missing).toHaveLength(3)
    expect(document.querySelector('.ant-picker input')).toHaveProperty('value', '')
  })
  it('只读的必填日期仍提示在官网选择，不静默跳过', async () => {
    document.body.innerHTML = '<div class="ant-form-item"><div class="ant-form-item-label"><label class="ant-form-item-required">入学时间</label></div><span class="ant-picker"><input readonly></span></div>'
    const result = await fillApplication({ educationStart: '2020-09' }, [], attachment)
    expect(result.filled).toEqual([])
    expect(result.missing.some(field => field.label.includes('入学时间'))).toBe(true)
  })
  it('只在对应的单选列表内精确选中，并核对已选展示值', async () => {
    document.body.innerHTML = '<div class="ant-form-item"><div class="ant-form-item-label"><label class="ant-form-item-required">最高学历</label></div><div class="ant-select"><input role="combobox" aria-controls="degrees" readonly><span class="ant-select-selection-item"></span></div></div><div id="degrees" role="listbox" hidden><div role="option">本科</div><div role="option">硕士</div></div><div role="listbox"><div role="option">本科</div></div>'
    const input = document.querySelector('input')!
    input.onclick = () => { document.getElementById('degrees')!.hidden = false }
    const option = document.querySelector<HTMLElement>('#degrees [role=option]')!
    option.onclick = () => { document.querySelector('.ant-select-selection-item')!.textContent = '本科'; document.getElementById('degrees')!.hidden = true }
    const result = await fillApplication({ degree: '本科' }, [], attachment)
    expect(input.value).toBe('') // Search box text is not used as selection proof.
    expect(result.filled).toContain('最高学历')
    expect(result.missing).toEqual([])
  })
  it.each(['unlinked', 'duplicate', 'rejected', 'disabled'])('下拉框 %s 时不误选或谎报成功', async mode => {
    document.body.innerHTML = `<div class="ant-form-item"><div class="ant-form-item-label"><label class="ant-form-item-required">最高学历</label></div><div class="ant-select"><input role="combobox" ${mode === 'unlinked' ? '' : 'aria-controls="degrees"'}><span class="ant-select-selection-item"></span></div></div><div id="degrees" role="listbox"><div role="option" ${mode === 'disabled' ? 'aria-disabled="true"' : ''}>本科</div>${mode === 'duplicate' ? '<div role="option">本科</div>' : ''}</div>`
    let clicked = 0
    document.querySelectorAll<HTMLElement>('[role=option]').forEach(element => { element.onclick = () => { clicked++ } })
    const result = await fillApplication({ degree: '本科' }, [], attachment)
    expect(clicked).toBe(mode === 'rejected' ? 1 : 0)
    expect(result.filled).toEqual([])
    expect(result.missing.some(field => field.label.includes('最高学历'))).toBe(true)
  })
  it('保留已有下拉选项，不替换用户选择', async () => {
    document.body.innerHTML = '<div class="ant-form-item"><div class="ant-form-item-label">学历</div><div class="ant-select"><input role="combobox"><span class="ant-select-selection-item">硕士</span></div></div>'
    let clicked = false; document.querySelector<HTMLInputElement>('input')!.onclick = () => { clicked = true }
    await fillApplication({ degree: '本科' }, [], attachment)
    expect(document.querySelector('.ant-select-selection-item')!.textContent).toBe('硕士'); expect(clicked).toBe(false)
  })
})
