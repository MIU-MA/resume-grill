'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MAIL_AGENT_URL, type AgentSnapshot } from '@/domain/mail-schema'

const TOKEN_KEY = 'mail-workbench:connection'
class ExpiredConnectionError extends Error {}
export function useMailAgent() {
  const [token, setToken] = useState('')
  const [snapshot, setSnapshot] = useState<AgentSnapshot | null>(null)
  const [connectionError, setConnectionError] = useState('')
  const tokenRef = useRef('')
  const readerVersion = useRef<boolean | undefined>(undefined)
  const [readerWarning, setReaderWarning] = useState('')
  const readCapabilities = (status: AgentSnapshot) => {
    readerVersion.current = status.capabilities?.careerReader === 'dynamic-v1'
    setReaderWarning(readerVersion.current ? '' : '当前连接的是旧版执行器，已兼容旧接口。重启本机执行器后才能使用动态官网读取；邮箱授权码无需重新填写。')
  }

  const request = useCallback(async <T,>(path: string, body?: unknown, overrideToken?: string): Promise<T> => {
    let response: Response
    try {
      const send = (payload: unknown) => fetch(`${MAIL_AGENT_URL}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${overrideToken ?? tokenRef.current}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        signal: AbortSignal.timeout(path === '/configure' || path === '/credentials/reconnect' ? 45000 : path === '/discover' || path === '/extract' ? 75000 : 25000),
        credentials: 'omit', cache: 'no-store', redirect: 'error',
      })
      const canUseLegacy = path === '/discover' && body && typeof body === 'object' && 'url' in body && 'keywords' in body
      const legacy = canUseLegacy ? { url: (body as { url: string }).url } : body
      response = await send(canUseLegacy && readerVersion.current === false ? legacy : body)
      // Read-only compatibility retry, never used for mail/configuration commands.
      if (response.status === 400 && canUseLegacy && readerVersion.current === undefined) {
        await response.body?.cancel()
        response = await send(legacy)
        if (response.ok) { readerVersion.current = false; setReaderWarning('当前执行器不支持岗位关键词参数，已使用兼容接口。重启执行器后启用动态官网读取。') }
      }
    } catch { throw new Error(path === '/discover' || path === '/extract' ? '官网读取未及时返回。可以重试这个链接，或在浏览器打开后粘贴岗位正文；已读取的岗位仍会保留。' : '本机执行器未响应。请检查终端是否还在运行，并允许浏览器访问本地网络；已提交的投递请先查看记录，不要重新添加。') }
    const data = await response.json()
    if (response.status === 401) throw new ExpiredConnectionError('执行器已重启或连接码已失效，请填写终端里的新连接码。已保存的邮箱授权码无需重新填写。')
    if (!response.ok) throw new Error(data.error ?? '操作失败')
    return data as T
  }, [])

  const connect = useCallback(async (value: string) => {
    const trimmed = value.trim()
    const status = await request<AgentSnapshot>('/status', undefined, trimmed)
    tokenRef.current = trimmed
    setToken(trimmed)
    window.sessionStorage.setItem(TOKEN_KEY, trimmed)
    setSnapshot(status)
    readCapabilities(status)
    setConnectionError('')
  }, [request])

  const refresh = useCallback(async () => {
    const currentToken = tokenRef.current
    try {
      const status = await request<AgentSnapshot>('/status')
      if (tokenRef.current !== currentToken) return null
      setSnapshot(status)
      readCapabilities(status)
      setConnectionError('')
      return status
    } catch (error) {
      if (tokenRef.current !== currentToken) return null
      if (error instanceof ExpiredConnectionError) {
        tokenRef.current = ''; setToken(''); window.sessionStorage.removeItem(TOKEN_KEY)
        readerVersion.current = undefined; setReaderWarning('')
      }
      setConnectionError(error instanceof Error ? error.message : '连接中断')
      setSnapshot(null)
      return null
    }
  }, [request])

  useEffect(() => {
    const saved = window.sessionStorage.getItem(TOKEN_KEY)
    if (saved) { tokenRef.current = saved; setToken(saved) }
  }, [])
  useEffect(() => {
    if (!token) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      await refresh()
      if (!stopped) timer = setTimeout(poll, 2500)
    }
    void poll()
    return () => { stopped = true; clearTimeout(timer) }
  }, [token, refresh])

  const command = useCallback(async (path: string, body: unknown = {}) => {
    const status = await request<AgentSnapshot>(path, body)
    setSnapshot(status)
    setConnectionError('')
    return status
  }, [request])

  const forgetConnection = useCallback(() => {
    tokenRef.current = ''
    readerVersion.current = undefined; setReaderWarning('')
    window.sessionStorage.removeItem(TOKEN_KEY)
    setToken(''); setSnapshot(null); setConnectionError('')
  }, [])

  return { token, snapshot, connectionError, readerWarning, connect, request, command, refresh, forgetConnection }
}
export type MailAgent = ReturnType<typeof useMailAgent>
