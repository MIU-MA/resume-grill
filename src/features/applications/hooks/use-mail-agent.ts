'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { MAIL_AGENT_URL, type AgentSnapshot } from '@/domain/mail-schema'

const TOKEN_KEY = 'mail-workbench:connection'
export function useMailAgent() {
  const [token, setToken] = useState('')
  const [snapshot, setSnapshot] = useState<AgentSnapshot | null>(null)
  const [connectionError, setConnectionError] = useState('')
  const tokenRef = useRef('')

  const request = useCallback(async <T,>(path: string, body?: unknown, overrideToken?: string): Promise<T> => {
    let response: Response
    try {
      response = await fetch(`${MAIL_AGENT_URL}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Bearer ${overrideToken ?? tokenRef.current}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(path === '/configure' ? 45000 : 25000),
        credentials: 'omit', cache: 'no-store', redirect: 'error',
      })
    } catch { throw new Error('本机执行器未响应。请检查终端是否还在运行，并允许浏览器访问本地网络；已提交的投递请先查看记录，不要重新添加。') }
    const data = await response.json()
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
    setConnectionError('')
  }, [request])

  const refresh = useCallback(async () => {
    const currentToken = tokenRef.current
    try {
      const status = await request<AgentSnapshot>('/status')
      if (tokenRef.current !== currentToken) return null
      setSnapshot(status)
      setConnectionError('')
      return status
    } catch (error) {
      if (tokenRef.current !== currentToken) return null
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
    window.sessionStorage.removeItem(TOKEN_KEY)
    setToken(''); setSnapshot(null); setConnectionError('')
  }, [])

  return { token, snapshot, connectionError, connect, request, command, refresh, forgetConnection }
}
export type MailAgent = ReturnType<typeof useMailAgent>
