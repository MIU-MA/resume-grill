// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fillApplication, profileKey } from './form-filler'

const resume = { name: 'resume.pdf', base64: 'YQ==' }
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function form(html: string) { document.body.innerHTML = `<form>${html}</form>` }

describe('官网实际 DOM 填写', () => {
  it('不选附件也能填写资料，只在官网必传时提示附件缺项', async () => {
    form('<label>姓名<input required></label><label>简历<input type="file"></label>')
    const optional = await fillApplication({ name: '测试人' }, [], null)
    expect(optional.filled).toContain('姓名')
    expect(optional.missing).toEqual([])
    form('<label>姓名<input required></label><label>简历<input type="file" required></label>')
    const required = await fillApplication({ name: '测试人' }, [])
    expect(required.filled).toContain('姓名')
    expect(required.missing).toContainEqual(expect.objectContaining({ kind: 'upload', label: expect.stringContaining('官网要求上传') }))
  })
  it('填写中英文标签、原生下拉框并触发框架事件，不点击提交', async () => {
    form('<label>姓名<input required></label><label>Email<input type="email" required></label><label>最高学历<select><option value="">请选择</option><option value="bachelor">本科</option></select></label><button type="submit">提交</button>')
    const submit = vi.fn(event => event.preventDefault()); document.querySelector('form')!.addEventListener('submit', submit)
    const input = vi.fn(); const change = vi.fn(); document.querySelector('input')!.addEventListener('input', input); document.querySelector('input')!.addEventListener('change', change)
    const result = await fillApplication({ name: '林同学', email: 'lin@example.com', degree: '本科' }, [], resume)
    expect([...document.querySelectorAll('input')].map(input => input.value)).toEqual(['林同学', 'lin@example.com'])
    expect(document.querySelector('select')!.value).toBe('bachelor')
    expect(result.filled).toHaveLength(3); expect(result.missing).toEqual([])
    expect(input).toHaveBeenCalledTimes(1); expect(change).toHaveBeenCalledTimes(1); expect(submit).not.toHaveBeenCalled()
  })
  it('保留用户填写值，跳过隐藏、只读、禁用和敏感字段，不默认勾选协议', async () => {
    form('<label>姓名<input value="用户自己填写"></label><label hidden>手机号<input required></label><label>邮箱<input readonly></label><label>手机号<input disabled></label><label>身份证号<input required></label><label><input type="checkbox" required>同意条款</label>')
    const result = await fillApplication({ name: '林同学', phone: '13800138000', email: 'lin@example.com' }, [], resume)
    expect(document.querySelector('input')!.value).toBe('用户自己填写')
    expect([...document.querySelectorAll('input')].slice(1, 5).every(input => input.value === '')).toBe(true)
    expect(document.querySelector<HTMLInputElement>('[type=checkbox]')!.checked).toBe(false)
    expect(result.missing.some(field => field.label.includes('身份证'))).toBe(true)
    expect(result.missing.some(field => field.label.includes('条款'))).toBe(true)
  })
  it('登录和验证码保持原页，处理后可再次运行填写', async () => {
    form('<input type="password"><label>姓名<input></label>')
    expect((await fillApplication({ name: '林同学' }, [], resume)).message).toContain('登录')
    form('<input autocomplete="one-time-code"><label>姓名<input></label>')
    const captcha = await fillApplication({ name: '林同学' }, [], resume)
    expect(captcha.missing.some(field => field.label.includes('验证码'))).toBe(true)
    expect(document.querySelectorAll('input')[1].value).toBe('林同学')
    document.querySelector<HTMLInputElement>('[autocomplete="one-time-code"]')!.value = '123456'
    expect((await fillApplication({ name: '林同学' }, [], resume)).missing).toEqual([])
    form('<label>姓名<input></label>')
    expect((await fillApplication({ name: '林同学' }, [], resume)).filled).toHaveLength(1)
  })
  it('缺少资料才询问，相同官网同名问题复用，其他网站的答案不跨用', async () => {
    form('<label>手机号<input required></label><label>到岗时间<input required></label>')
    const missing = await fillApplication({}, [], resume)
    expect(missing.missing).toContainEqual({ label: '手机号', key: 'phone', kind: 'profile' })
    const result = await fillApplication({ phone: '13800138000' }, [{ origin: 'https://other.example', scope: '公司\n岗位', label: '到岗时间', value: '下周' }, { origin: location.origin, scope: '其他公司\n岗位', label: '到岗时间', value: '明天' }, { origin: location.origin, scope: '公司\n岗位', label: '到岗时间', value: '两周后' }], resume, '公司\n岗位')
    expect(document.querySelectorAll('input')[1].value).toBe('两周后')
    expect(result.missing).toEqual([])
  })
  it('不会把最近公司、学校资料覆盖到多段经历上', async () => {
    form('<label>当前公司<input required></label><label>当前公司<input required></label><label>学校<input></label><label>学校<input></label>')
    const result = await fillApplication({ company: '最近公司', school: '示例大学' }, [], resume)
    expect([...document.querySelectorAll('input')].every(input => input.value === '')).toBe(true)
    expect(result.missing.every(field => field.kind === 'manual')).toBe(true)
  })
  it('日期和下拉选项不匹配时交回用户，不猜选项', async () => {
    form('<label>毕业时间<input type="date" required></label><label>学历<select required><option value="">请选择</option><option value="master">硕士</option></select></label>')
    const result = await fillApplication({ educationEnd: '2026-06', degree: '本科' }, [], resume)
    expect(result.missing).toHaveLength(2)
    expect(document.querySelector('input')!.value).toBe(''); expect(document.querySelector('select')!.value).toBe('')
  })
  it('识别带非空占位值的下拉框和 aria 必填项，不把占位项当成用户选择', async () => {
    form('<label>学历<select aria-required="true"><option value="-1">请选择学历</option><option value="bachelor">本科</option></select></label><label>手机号<input aria-required="true"></label>')
    const result = await fillApplication({ degree: '本科' }, [], resume)
    expect(document.querySelector('select')!.value).toBe('bachelor')
    expect(result.missing).toContainEqual({ label: '手机号', key: 'phone', kind: 'profile' })
  })
  it('上传 PDF 到明确的简历控件，不上传到照片或求职信控件', async () => {
    form('<label>简历<input type="file" accept=".pdf" required></label><label>证件照<input type="file" required></label><label>求职信<input type="file"></label>')
    const files: File[] = []
    vi.stubGlobal('DataTransfer', class { items = { add: (file: File) => files.push(file) }; get files() { return files } })
    const input = document.querySelector<HTMLInputElement>('input')!
    let attached: File[] = []
    Object.defineProperty(input, 'files', { get: () => attached, set: value => { attached = value }, configurable: true })
    const changed = vi.fn(); input.addEventListener('change', changed)
    const result = await fillApplication({}, [], resume)
    expect(attached[0].name).toBe('resume.pdf'); expect(attached[0].type).toBe('application/pdf')
    expect(result.uploaded).toBe(true); expect(changed).toHaveBeenCalledTimes(1)
    expect(document.querySelectorAll<HTMLInputElement>('input')[1].files?.length).toBe(0)
    expect(result.missing.some(field => field.label.includes('证件照'))).toBe(true)
  })
  it('页面不接受值、附件格式不符或上传接口不可用时不宣称成功', async () => {
    form('<label>姓名<input required></label><label>简历<input type="file" accept=".docx" required></label>')
    document.querySelector('input')!.addEventListener('input', event => { (event.target as HTMLInputElement).value = '' })
    const result = await fillApplication({ name: '林同学' }, [], resume)
    expect(result.uploaded).toBe(false); expect(result.filled).toEqual([])
    expect(result.missing.some(field => field.label.includes('页面未接受'))).toBe(true)
    expect(result.missing.some(field => field.label.includes('格式'))).toBe(true)
  })
  it('普通搜索页不标为申请已准备，必填自定义控件明确交回用户', async () => {
    form('<input placeholder="搜索岗位">')
    expect((await fillApplication({}, [], resume)).missing[0].label).toContain('未找到')
    form('<label>姓名<input></label><div role="combobox" aria-required="true"></div>')
    expect((await fillApplication({ name: '林同学' }, [], resume)).missing.some(field => field.label.includes('自定义'))).toBe(true)
  })
  it('标签映射不把敏感字段当作普通联系方式', () => {
    expect(profileKey('紧急联系人电话', 'tel')).toBeUndefined()
    expect(profileKey('毕业时间')).toBe('educationEnd')
    expect(profileKey('Full name')).toBe('name')
  })
})
