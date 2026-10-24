import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { LinkImporter } from './LinkImporter'
import { careerSites } from '@/data/career-sites'

describe('官网链接入口', () => {
  it('未连接执行器也能展开目录，默认收起且公司链接仍直接打开官网', () => {
    const onImported = vi.fn(), read = vi.fn(), discover = vi.fn()
    const html = renderToStaticMarkup(createElement(LinkImporter, { existingUrls: [], existingJobs: [], slots: 20, connected: false, onConnect: vi.fn(), read, discover, onImported, onBusy: vi.fn() }))
    const $ = load(html), directory = $('[aria-label="招聘官网"]')
    expect(directory.closest('[hidden]').length).toBe(0)
    const disclosure = directory.closest('details')
    expect(disclosure.attr('open')).toBeUndefined()
    expect(disclosure.children('summary').text()).toContain('浏览招聘官网')
    expect(directory.find('a').length).toBe(careerSites.length)
    expect($('label').text()).not.toContain('有前端线索')
    expect($('.career-directory-search input[type="checkbox"]').length).toBe(0)
    for (const site of careerSites) {
      const anchor = directory.find(`a[href="${site.url}"]`)
      expect(anchor.text()).toContain(site.company)
      expect(anchor.attr('target')).toBe('_blank')
    }
    // 常用的粘贴入口直接显示，目录仍按需展开。
    const linkInput = $('textarea[aria-label="招聘链接，每行一个"]')
    expect(linkInput.length).toBe(1)
    expect(linkInput.closest('details, [hidden]').length).toBe(0)
    expect(read).not.toHaveBeenCalled(); expect(discover).not.toHaveBeenCalled(); expect(onImported).not.toHaveBeenCalled()
  })
  it('招聘官网独立入口默认展开完整目录', () => {
    const html = renderToStaticMarkup(createElement(LinkImporter, { expandedDirectory: true, existingUrls: [], existingJobs: [], slots: 20, connected: false, onConnect: vi.fn(), read: vi.fn(), discover: vi.fn(), onImported: vi.fn(), onBusy: vi.fn() }))
    const $ = load(html)
    expect($('[aria-label="招聘官网"]').closest('details').attr('open')).toBeDefined()
    expect($('[aria-label="招聘官网"] a').length).toBe(careerSites.length)
  })
})
