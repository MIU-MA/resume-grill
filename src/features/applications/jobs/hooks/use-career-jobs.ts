'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { CareerDiscovery, CareerPage } from '@/domain/mail-schema'
import { recordCareerDiscovery, type CareerJobsStore } from '../lib/career-jobs'
import { createCareerJobsWriter, loadCareerJobs } from '../lib/career-jobs-storage'

export function useCareerJobs({ discover, read, connected, onConnect, onBusy, onError }: {
  discover: (url: string) => Promise<CareerDiscovery>
  read: (url: string) => Promise<CareerPage>
  connected: boolean
  onConnect: () => void
  onBusy: (busy: boolean) => void
  onError: (message: string) => void
}) {
  const [store, setStore] = useState<CareerJobsStore>(() => ({ version: 1, sites: {} }))
  const [hydrated, setHydrated] = useState(false)
  const [busyUrl, setBusyUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [allProgress, setAllProgress] = useState<{ done: number; total: number } | null>(null)
  const [writer] = useState(() => createCareerJobsWriter())
  const busy = useRef(false)
  const allBusy = useRef(false)
  const stopAll = useRef(false)
  const storeRef = useRef(store)
  const pending = useRef<{ company: string; url: string } | null>(null)

  useEffect(() => {
    let active = true
    void loadCareerJobs().then(value => { if (active) { storeRef.current = value; setStore(value); setHydrated(true) } }).catch(() => {
      if (!active) return
      setError('招聘官网缓存读取失败，刷新后可以重试。')
      setHydrated(true)
    })
    return () => { active = false }
  }, [])

  const persist = async (next: CareerJobsStore) => {
    storeRef.current = next
    setStore(next)
    await writer(next).catch(() => { setError('岗位缓存未能保存到浏览器，刷新后可能丢失。'); onError('岗位缓存未能保存到浏览器。') })
  }

  const readSite = async (company: string, url: string) => {
    if (busy.current) return
    if (!connected) { pending.current = { company, url }; onConnect(); return }
    busy.current = true
    setBusyUrl(url); setError(''); onBusy(true)
    try {
      const discovery = await discover(url)
      await persist(recordCareerDiscovery(storeRef.current, { company, url, discovery }))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '官网读取失败，可以稍后重试。'
      setError(message)
      await persist(recordCareerDiscovery(storeRef.current, { company, url, error: message }))
    } finally {
      busy.current = false
      setBusyUrl(null)
      onBusy(false)
    }
  }
  const resumeRead = useEffectEvent((company: string, url: string) => { void readSite(company, url) })
  useEffect(() => {
    if (!connected || !pending.current || busy.current) return
    const target = pending.current
    pending.current = null
    resumeRead(target.company, target.url)
  }, [connected])

  const readPage = async (url: string) => {
    if (!connected) { onConnect(); throw new Error('先连接本机执行器，再读取岗位。') }
    return read(url)
  }

  const readAll = async (sites: ReadonlyArray<{ company: string; url: string }>) => {
    if (allBusy.current || busy.current) return
    if (!connected) { onConnect(); return }
    allBusy.current = true
    stopAll.current = false
    setAllProgress({ done: 0, total: sites.length })
    try {
      for (let index = 0; index < sites.length; index++) {
        if (stopAll.current) break
        await readSite(sites[index].company, sites[index].url)
        setAllProgress({ done: index + 1, total: sites.length })
      }
    } finally {
      allBusy.current = false
      setAllProgress(null)
    }
  }
  const cancelReadAll = () => { stopAll.current = true }

  return { store, hydrated, busyUrl, error, setError, readSite, readPage, readAll, allProgress, cancelReadAll }
}
