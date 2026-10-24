// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { biliExperienceGroups, domesticSite } from './domestic-sites'
import { fillApplication } from './form-filler'
import { experienceFieldKey } from './experience-fields'
import type { WebsiteExperience } from '../domain/website-experience'

const fixture = readFileSync('data/website-forms/bilibili-source-contract.html', 'utf8')
const attachment = { name: 'resume.txt', base64: 'YQ==' }
const experiences: WebsiteExperience[] = ['甲公司', '乙公司'].map((organization, i) => ({ id: String(i), kind: 'work', organization, title: '前端开发', start: '2023-01', end: '2024-02', description: `经历 ${i + 1}` }))
beforeEach(() => { vi.stubGlobal('location', new URL('https://jobs.bilibili.com/social/resume')); document.body.innerHTML = fixture })
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals() })

describe('B站公开渲染代码的重建契约（未登录实测）', () => {
  it('按栏目标题和编号对应多段经历，不点击保存', async () => {
    let saved = false; document.querySelector('button')!.onclick = () => { saved = true }
    const result = await fillApplication({ name: '测试人', email: 'test@example.com' }, [], attachment, '', experiences)
    expect([...document.querySelectorAll('.bili-form-multiple')].map(row => row.querySelector('input')!.value)).toEqual(['甲公司', '乙公司'])
    expect([...document.querySelectorAll('textarea')].map(input => input.value)).toEqual(['经历 1', '经历 2'])
    expect(result.message).toContain('实站待验证'); expect(saved).toBe(false)
  })
  it('官网上传组件需要完成提示，FileList 不算上传确认', async () => {
    const input = document.querySelector<HTMLInputElement>('[type=file]')!
    Object.defineProperty(input, 'files', { value: [new File(['a'], 'resume.txt')], configurable: true })
    expect((await fillApplication({}, [], attachment)).uploaded).toBe(false)
    const name = document.createElement('h5'); name.className = 'bili-resume-annalysis-name'; name.textContent = 'resume.txt'
    document.querySelector('.bili-resume-analysis')!.append(name)
    expect((await fillApplication({}, [], attachment)).uploaded).toBe(true)
    const busy = document.createElement('span'); busy.textContent = '更新中...'; name.after(busy)
    expect((await fillApplication({}, [], attachment)).uploaded).toBe(false)
  })
  it('伪域名不启用 B站规则，无法识别的编号不猜', () => {
    expect(biliExperienceGroups()).toHaveLength(2)
    document.querySelector('.bili-form-multiple-tag')!.textContent = '第一段'
    expect(biliExperienceGroups()).toHaveLength(1)
    vi.stubGlobal('location', new URL('https://jobs.bilibili.com.example.com/'))
    expect(biliExperienceGroups()).toEqual([])
    expect(domesticSite(location.hostname)).toBeUndefined()
  })
  it('名称、职责、城市与时间不串字段', () => {
    expect(experienceFieldKey('公司名称')).toBe('organization')
    expect(experienceFieldKey('公司描述')).toBe('description')
    expect(experienceFieldKey('项目职务')).toBe('title')
    expect(experienceFieldKey('学校所在城市')).toBeUndefined()
    expect(experienceFieldKey('起止时间')).toBeUndefined()
  })
})
