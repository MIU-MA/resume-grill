import { describe, expect, it } from 'vitest'
import { inferSmtpProvider, smtpConfigSchema } from './mail-schema'

describe('发件邮箱类型识别', () => {
  it.each([
    ['candidate@qq.com', 'qq'], ['candidate@foxmail.com', 'qq'],
    ['candidate@163.com', '163'], [' Candidate@163.COM ', '163'],
  ])('识别 %s 为 %s', (address, provider) => {
    expect(inferSmtpProvider(address)).toBe(provider)
  })

  it.each(['candidate@', 'candidate@126.com', 'candidate@163.com.example.com', 'candidate@evil163.com', 'candidate@example.com', ''])('不把未知或不完整地址 %s 当作已支持邮箱', address => {
    expect(inferSmtpProvider(address)).toBeNull()
  })

  it('接受网易 163 客户端授权配置，仍拒绝选错类型和任意服务器字段', () => {
    const config = { provider: '163', address: 'Candidate@163.COM', name: '测试人', authorizationCode: 'TEST-AUTHORIZATION-CODE' }
    expect(smtpConfigSchema.parse(config).address).toBe('candidate@163.com')
    expect(smtpConfigSchema.safeParse({ ...config, provider: 'qq' }).success).toBe(false)
    expect(smtpConfigSchema.safeParse({ ...config, host: 'custom.example.com' }).success).toBe(false)
    expect(smtpConfigSchema.safeParse({ ...config, address: 'candidate@126.com' }).success).toBe(false)
  })
})
