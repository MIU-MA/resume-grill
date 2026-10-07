import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { LinkImporter } from './LinkImporter'
import { careerSites } from '@/data/career-sites'

describe('官网链接入口', () => {
  it('未连接执行器也直接展示官网目录，公司的链接直接打开官网', () => {
    const onImported = vi.fn(), read = vi.fn(), discover = vi.fn()
    const html = renderToStaticMarkup(createElement(LinkImporter, { existingUrls: [], slots: 20, connected: false, onConnect: vi.fn(), read, discover, onImported, onBusy: vi.fn() }))
    const $ = load(html), directory = $('[aria-label="招聘官网"]')
    expect(directory.closest('[hidden],details:not([open])').length).toBe(0)
    expect(directory.find('a').length).toBe(careerSites.length)
    for (const site of careerSites) {
      const anchor = directory.find(`a[href="${site.url}"]`)
      expect(anchor.text()).toContain(site.company)
      expect(anchor.attr('target')).toBe('_blank')
    }
    expect($('textarea[aria-label="招聘链接，每行一个"]').closest('details').length).toBe(1)
    expect(read).not.toHaveBeenCalled(); expect(discover).not.toHaveBeenCalled(); expect(onImported).not.toHaveBeenCalled()
  })
})
