import { useEffect, useState } from 'react'
import type { BrowserRun } from '@/domain/browser-application'
import { bossRequest, type BossConnection } from '../lib/boss-client'

export function useBossRun(connection: BossConnection | null, key: string, endpoint: string, save: (run: BrowserRun) => Promise<void>) {
  const [id, setId] = useState('')
  const [run, setRun] = useState<BrowserRun | null>(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const reload = () => { setError(''); setRefresh(value => value + 1) }

  useEffect(() => { setId(sessionStorage.getItem(key) ?? '') }, [key])
  useEffect(() => {
    if (!connection || !id) return
    let active = true, timer: ReturnType<typeof setTimeout>
    const read = async () => {
      try {
        const value = await bossRequest<BrowserRun>(connection, `${endpoint}/${id}`)
        if (!active) return
        setRun(value); setSaved(false)
        try {
          await save(value)
          if (active) { setSaved(true); setError('') }
        } catch { if (active) setError('执行状态未能写入本机记录，可以重新读取。') }
        if (active && value.state === 'running') timer = setTimeout(read, 1000)
      } catch (failure) { if (active) setError(current => current || (failure instanceof Error ? failure.message : '无法读取批次状态')) }
    }
    void read()
    return () => { active = false; clearTimeout(timer) }
  }, [connection, endpoint, id, refresh, save])

  const open = (nextId: string, message = '') => {
    setRun(null); setSaved(false); setError(message); setId(nextId)
    if (nextId) sessionStorage.setItem(key, nextId)
    else sessionStorage.removeItem(key)
    setRefresh(value => value + 1)
  }
  const submit = async (nextId: string, action: () => Promise<unknown>) => {
    sessionStorage.setItem(key, nextId)
    try { await action() }
    catch (failure) {
      open(nextId, failure instanceof Error ? failure.message : '提交失败，请读取执行状态')
      return
    }
    open(nextId)
  }
  return { id, run, saved, error, reload, open, submit }
}
