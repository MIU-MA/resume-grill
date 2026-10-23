// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fillApplication } from './form-filler'
import { leverForm } from './lever-adapter'

const fixture = readFileSync(resolve('data/website-forms/lever-pigment.html'), 'utf8')
const attachment = { name: 'resume.pdf', base64: 'YQ==' }
const profile = { name: '测试候选人', email: 'test@example.com', phone: '13800138000', company: '测试公司', city: 'London' }
const input = (name: string) => document.querySelector<HTMLInputElement>(`input[name="${name}"]`)!

beforeEach(() => {
  vi.stubGlobal('location', new URL('https://jobs.lever.co/pigment/sample/apply'))
  document.title = 'Senior Frontend Engineer - Apply'
  document.body.innerHTML = fixture
})
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals() })

describe('Lever 公开申请页结构回归', () => {
  it('识别外置问题标题并填写基础资料，保留城市和必答选择题供官网处理', async () => {
    const result = await fillApplication(profile, [], attachment)
    expect(input('name').value).toBe(profile.name)
    expect(input('email').value).toBe(profile.email)
    expect(input('phone').value).toBe(profile.phone)
    expect(input('org').value).toBe(profile.company)
    expect(input('location').value).toBe('')
    expect(input('selectedLocation').value).toBe('')
    expect(result.filled).toContain('Current company')
    expect(result.missing.some(field => field.label.includes('sponsorship'))).toBe(true)
    expect(result.missing.some(field => field.label.includes('Current location'))).toBe(true)
    expect(result.uploaded).toBe(false)
    expect(result.message).toContain('Lever 基础字段适配')
  })
  it('不会把文件放入控件误认为官网上传成功，也不覆盖已有资料', async () => {
    input('name').value = '用户原有姓名'
    Object.defineProperty(input('resume'), 'files', { value: [new File(['a'], 'resume.pdf')], configurable: true })
    const result = await fillApplication(profile, [], attachment)
    expect(result.uploaded).toBe(false)
    expect(result.missing.some(field => field.label.includes('上传确认'))).toBe(true)
    expect(input('name').value).toBe('用户原有姓名')
  })
  it('读取官网已有上传确认与已选问题，不重复上传或强制勾选其他答案', async () => {
    input('resumeStorageId').value = 'server-generated-id'
    input('selectedLocation').value = '{"name":"London"}'
    for (const question of document.querySelectorAll('.custom-question')) question.querySelector<HTMLInputElement>('input')!.checked = true
    const change = vi.fn(); input('resume').addEventListener('change', change)
    const result = await fillApplication(profile, [], attachment)
    expect(result.uploaded).toBe(true)
    expect(result.missing.filter(field => /sponsorship|Current location|上传确认/.test(field.label))).toEqual([])
    expect(change).not.toHaveBeenCalled()
  })
  it('仅匹配准确站点和表单，不对仿冒域名启用专用规则', () => {
    vi.stubGlobal('location', new URL('https://jobs.lever.co.example.com/pigment/sample/apply'))
    expect(leverForm()).toBeNull()
    vi.stubGlobal('location', new URL('https://jobs.lever.co/pigment/sample/apply'))
    document.querySelector('form')!.removeAttribute('id')
    expect(leverForm()).toBeNull()
  })
})
