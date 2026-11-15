'use client'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { BossInspection } from '@/domain/boss-inspection'
import type { BossJob } from './lib/boss-preparation'
import { bossRequest, type BossConnection } from './lib/boss-client'

export function BossJobDetails({ connection, readId, jobs, disabled, onBusy, onChanged }: { connection: BossConnection | null; readId: string; jobs: BossJob[]; disabled: boolean; onBusy: (busy: boolean) => void; onChanged: () => void }) {
  const [results, setResults] = useState<Record<string, BossInspection>>({})
  const [reading, setReading] = useState('')
  const [error, setError] = useState('')
  const stop = useRef(false)
  const version = useRef(0)
  useEffect(() => { const current = ++version.current; setResults({}); setReading(''); setError(''); return () => { version.current = current + 1; stop.current = true } }, [readId])
  const read = async () => {
    if (!connection || reading) return
    const current = version.current
    stop.current = false; setError(''); onBusy(true)
    try {
      for (const job of jobs) {
        if (stop.current || version.current !== current) break
        setReading(job.title)
        const result = await bossRequest<BossInspection>(connection, '/inspect-job', { readId, url: job.url })
        if (version.current !== current) break
        setResults(values => ({ ...values, [job.url]: result })); onChanged()
        if (result.kind === 'login' || result.kind === 'verification') break
      }
    } catch (failure) { if (version.current === current) setError(failure instanceof Error ? failure.message : '详情读取失败') }
    finally { if (version.current === current) { setReading(''); onBusy(false) } }
  }
  return <section className="border border-line p-4" aria-label="岗位详情核对"><div className="flex flex-wrap items-center gap-3"><h2 className="text-section font-medium">完整岗位要求</h2><Button variant="secondary" disabled={!connection || disabled || !jobs.length} onClick={() => void read()}>读取所选岗位 JD</Button>{reading && <Button variant="link" onClick={() => { stop.current = true }}>读完当前岗位后停止</Button>}</div><p className="mt-2 text-label text-text-secondary">后台逐个打开详情，核对后自动用于招呼语准备。读完关闭临时页面，不点击沟通或投递。</p>{reading && <p role="status" className="mt-2 text-body">正在读取：{reading}</p>}{error && <p role="alert" className="mt-2 text-body text-danger">{error}</p>}<div className="mt-3 space-y-3">{Object.entries(results).map(([url, result]) => <article key={url} className="border-t border-line pt-3"><p className="text-body font-medium">{result.title || jobs.find(job => job.url === url)?.title} · {result.matched && !result.blockers.length ? `已核对 · ${result.description.length} 字` : '未采用此详情'}</p>{result.blockers.map(message => <p key={message} className="mt-1 text-label text-danger">{message}</p>)}<p className="mt-1 text-meta text-text-secondary">沟通入口：{result.communication.count === 1 && result.communication.enabled === 1 ? `${result.communication.labels.join('、')}（未点击）` : '未识别或不唯一，不能据此执行发送'}</p>{result.description && <details className="mt-2 text-label"><summary className="cursor-pointer">查看读取的岗位描述</summary><p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-body">{result.description}</p></details>}</article>)}</div></section>
}
