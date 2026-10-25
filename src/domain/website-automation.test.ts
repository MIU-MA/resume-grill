import { expect, it } from 'vitest'
import { isWorkbenchUrl } from './website-automation'

it('扩展支持三个投递页面，同时保留回环地址、端口与路径限制', () => {
  for (const host of ['localhost', '127.0.0.1']) for (const port of [3000, 3107]) {
    for (const path of ['/', '/applications', '/careers', '/application-history']) {
      expect(isWorkbenchUrl(`http://${host}:${port}${path}`)).toBe(true)
    }
  }
  for (const url of ['https://example.com/careers', 'http://localhost:3001/careers', 'http://127.0.0.1.evil.test:3000/careers', 'http://localhost:3000/other']) {
    expect(isWorkbenchUrl(url)).toBe(false)
  }
})
