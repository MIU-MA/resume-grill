import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { load } from 'cheerio'
import { LinkImporter } from '../LinkImporter'

describe('招聘链接入口', () => {
  it('粘贴链接仍然是直接入口，不再在投递页重复一份官网目录', () => {
    const onImported = vi.fn(), read = vi.fn()
    const html = renderToStaticMarkup(createElement(LinkImporter, { existingUrls: [], existingJobs: [], slots: 20, connected: false, onConnect: vi.fn(), read, onImported, onBusy: vi.fn() }))
    const $ = load(html)
    expect($('[aria-label="招聘官网"]').length).toBe(0)
    expect($('textarea[aria-label="招聘链接，每行一个"]').length).toBe(1)
    expect($('button').filter((_, node) => $(node).text() === '粘贴正文').length).toBe(1)
    expect(read).not.toHaveBeenCalled(); expect(onImported).not.toHaveBeenCalled()
  })
})
