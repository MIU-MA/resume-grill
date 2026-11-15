import { expect, it } from 'vitest'
import { parseBossConnection } from './boss-client'
it('仅接受本机服务地址和有效本次凭据', () => {
  const token = 'a'.repeat(48)
  expect(parseBossConnection(`http://localhost:3000/boss#boss-token=${token}`)).toEqual({ origin: 'http://127.0.0.1:4327', token })
  for (const origin of ['https://example.com', 'http://example.com', 'http://127.0.0.1@evil.com', 'http://127.0.0.1/private']) {
    expect(() => parseBossConnection(`http://localhost/boss#boss-token=${token}&boss-origin=${encodeURIComponent(origin)}`)).toThrow()
  }
  expect(() => parseBossConnection('http://localhost/boss#boss-token=old')).toThrow()
})
