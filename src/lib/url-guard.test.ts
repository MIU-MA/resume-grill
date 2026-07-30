import { afterEach, describe, expect, it } from 'vitest'
import { assertAllowedBaseUrl } from './url-guard'

const originalAllowlist = process.env.ALLOWED_LLM_BASE_URLS

afterEach(() => {
  if (originalAllowlist === undefined) delete process.env.ALLOWED_LLM_BASE_URLS
  else process.env.ALLOWED_LLM_BASE_URLS = originalAllowlist
})

describe('assertAllowedBaseUrl allowlist', () => {
  it('allows an exact local origin including its port', async () => {
    process.env.ALLOWED_LLM_BASE_URLS = 'http://127.0.0.1:11434'
    await expect(assertAllowedBaseUrl('http://127.0.0.1:11434/v1')).resolves.toBeUndefined()
  })

  it('rejects the same host on a port that is not allowed', async () => {
    process.env.ALLOWED_LLM_BASE_URLS = 'http://127.0.0.1:11434'
    await expect(assertAllowedBaseUrl('http://127.0.0.1:8080/v1')).rejects.toThrow('不在服务端允许的白名单内')
  })
})
