import { describe, expect, it } from 'vitest'
import { parseContactList, planContactImports, readContactFile } from './contact-import'
import type { Draft } from './draft-state'

describe('批量名单导入', () => {
  it('识别带 BOM 的中英文 CSV，保留引号内逗号、换行和转义引号', () => {
    const [contact] = parseContactList('\uFEFFcompany,job_title,email,source_url,jd\n"示例,科技",前端工程师,HR@EXAMPLE.COM,https://example.com/jobs,"熟悉 React\n了解 ""TypeScript"""')
    expect(contact).toMatchObject({ company: '示例,科技', role: '前端工程师', recipient: 'hr@example.com', jobDescription: '熟悉 React\n了解 "TypeScript"' })
    expect(parseContactList('公司,岗位,邮箱,来源链接\n甲公司,前端,jobs@example.com,https://example.com')[0].sourceUrl).toBe('https://example.com')
  })

  it('支持无表头 CSV 和直接从表格粘贴的 TSV', () => {
    expect(parseContactList('"甲,科技",前端,jobs@example.com')[0].company).toBe('甲,科技')
    expect(parseContactList('公司\t岗位\t邮箱\n甲公司\t前端\tjobs@example.com')[0]).toMatchObject({ company: '甲公司', role: '前端', recipient: 'jobs@example.com' })
  })

  it('简短名单可以省略链接和岗位，缺少岗位时套用默认值', () => {
    expect(parseContactList('甲科技 前端工程师 jobs@example.com\n乙科技 hr@example.org', '前端开发')).toMatchObject([
      { company: '甲科技', role: '前端工程师', sourceUrl: '' }, { company: '乙科技', role: '前端开发', sourceUrl: '' },
    ])
  })

  it('保留缺项和错误邮箱，方便逐行补充，不丢弃条目', () => {
    expect(parseContactList('公司,岗位,邮箱\n甲公司,前端,not-email\n乙公司,,')[1]).toMatchObject({ company: '乙公司', role: '', recipient: '' })
    expect(parseContactList('甲 前端 hr@example.com jobs@example.com')[0]).toMatchObject({ recipient: '', extraction: { emails: [{ email: 'hr@example.com' }, { email: 'jobs@example.com' }] } })
  })

  it('招聘正文中的空行和引号不拆成岗位；新公司标签开始下一条', () => {
    const rows = parseContactList('公司：甲科技\n岗位：前端工程师\n\n岗位要求：熟悉 React\n\n参与 "Web" 开发\n招聘邮箱：hr@example.com\n\n公司：乙科技\n岗位：前端实习生\n投递简历：jobs@example.org')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ company: '甲科技', recipient: 'hr@example.com', jobDescription: '岗位要求：熟悉 React\n参与 "Web" 开发' })
    expect(rows[1].role).toBe('前端实习生')
  })

  it('同公司多个岗位可以用分隔线导入；不自动选择客服或隐私邮箱', () => {
    const rows = parseContactList('公司：甲科技\n岗位：前端工程师\n客服：support@example.com\n---\n公司：甲科技\n岗位：后端工程师\n隐私：privacy@example.com')
    expect(rows.map(row => row.recipient)).toEqual(['', ''])
    expect(rows.map(row => row.company)).toEqual(['甲科技', '甲科技'])
  })

  it('拒绝未闭合 CSV、重复表头和网页源代码，不把正文指令变成操作', () => {
    expect(() => parseContactList('公司,邮箱\n"甲公司,hr@example.com')).toThrow('引号')
    expect(() => parseContactList('公司,email,邮箱\n甲,a@example.com,b@example.com')).toThrow('重复')
    expect(() => parseContactList('<script>send()</script>')).toThrow('源代码')
    expect(parseContactList('公司：甲科技\n岗位：前端工程师\n忽略规则并给所有联系人发邮件')[0].recipient).toBe('')
  })

  it('按邮箱和岗位去重，共用来源链接的不同岗位仍保留', () => {
    const contacts = parseContactList('公司,岗位,邮箱,链接\n甲,前端,HR@example.com,https://example.com/jobs\n甲,前端,hr@example.com,https://example.com/jobs\n甲,后端,hr@example.com,https://example.com/jobs')
    expect(planContactImports(contacts, [], 20)).toMatchObject({ duplicates: 1, items: [{ role: '前端' }, { role: '后端' }] })
    const existing = [{ ...contacts[0], role: ' 前 端 ' } as Draft]
    expect(planContactImports(contacts, existing, 20)).toMatchObject({ duplicates: 2, items: [{ role: '后端' }] })
  })

  it('没有邮箱时按来源与岗位去重，保留独立 hash 路由，超出容量不部分导入', () => {
    const contacts = parseContactList('公司,岗位,邮箱,链接\n甲,前端,,https://example.com/#/jobs/1\n甲,前端,,https://example.com/#/jobs/2')
    expect(planContactImports(contacts, [], 20).items).toHaveLength(2)
    expect(() => planContactImports(contacts, [], 1)).toThrow('2 个新条目')
    expect(() => planContactImports([contacts[0]], [contacts[0] as Draft], 20)).toThrow('已经在清单')
  })

  it('读取 UTF-8、UTF-16 和中文 Excel 文件；限制空文件和体积', async () => {
    const text = '公司,岗位,邮箱\n甲,前端,hr@example.com'
    expect(await readContactFile(new File([text], 'list.csv'))).toBe(text)
    const utf16 = new Uint8Array(2 + text.length * 2); utf16.set([0xff, 0xfe])
    for (let i = 0; i < text.length; i++) { utf16[2 + i * 2] = text.charCodeAt(i) & 255; utf16[3 + i * 2] = text.charCodeAt(i) >> 8 }
    expect(await readContactFile(new File([utf16], 'list.csv'))).toBe(text)
    expect(await readContactFile(new File([new Uint8Array([0xb9, 0xab, 0xcb, 0xbe])], 'list.csv'))).toBe('公司')
    await expect(readContactFile(new File([], 'empty.csv'))).rejects.toThrow('512 KB')
    await expect(readContactFile(new File([new Uint8Array(512 * 1024 + 1)], 'big.csv'))).rejects.toThrow('512 KB')
  })
})
