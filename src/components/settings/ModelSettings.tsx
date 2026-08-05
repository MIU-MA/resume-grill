'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, Eye, EyeOff, Loader2, Trash2, XCircle } from 'lucide-react'
import { clearLlmSettings, clearTestResult as clearPersistedTestResult, getLlmSettings, setLlmSettings, setTestResult as persistTestResult, type LlmSettings } from '@/lib/settings'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

const DEFAULTS: LlmSettings = { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-5.4-mini' }

type Provider = { label: string; baseUrl: string; model: string }

const PROVIDERS: Provider[] = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-5.4-mini' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash' },
  { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen3.7-plus' },
  { label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5.2' },
  { label: 'MiniMax', baseUrl: 'https://api.minimaxi.com/v1', model: 'MiniMax-M3' },
]

type Mode = { label: string; cls: 'local' | 'env' | 'mock' }

function deriveMode(envConfigured: boolean, clientConfigured: boolean): Mode {
  if (clientConfigured) return { label: '本地 Key', cls: 'local' }
  if (envConfigured) return { label: '服务端 Key', cls: 'env' }
  return { label: '规则示例', cls: 'mock' }
}

const CHIP_VARIANT: Record<Mode['cls'] | 'success' | 'danger', string> = {
  local: 'text-success bg-green-soft',
  env: 'text-brand bg-brand-soft',
  mock: 'text-warning bg-warning-soft',
  success: 'text-success bg-green-soft',
  danger: 'text-danger bg-danger-soft',
}

type ModelSettingsProps = {
  envConfigured: boolean
  clientConfigured: boolean
  onClientChanged: () => void
}

const inputCls = 'h-8 rounded-lg border border-line-strong bg-white px-3 text-[12px] text-text-primary focus:border-brand focus:outline-brand'

export function ModelSettings({ envConfigured, clientConfigured, onClientChanged }: ModelSettingsProps) {
  const [form, setForm] = useState<LlmSettings>(DEFAULTS)
  const [showKey, setShowKey] = useState(false)
  const [providerIdx, setProviderIdx] = useState(-1)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [testError, setTestError] = useState('')

  useEffect(() => {
    const saved = getLlmSettings()
    if (saved) setForm(saved)
  }, [])

  const mode = deriveMode(envConfigured, clientConfigured)

  const selectProvider = (idx: number) => {
    setProviderIdx(idx)
    if (idx >= 0) {
      const p = PROVIDERS[idx]
      setForm((f) => ({ ...f, baseUrl: p.baseUrl, model: p.model }))
    }
  }

  const handleSave = () => { setLlmSettings(form); onClientChanged() }

  const handleClear = () => { clearLlmSettings(); clearPersistedTestResult(); setForm(DEFAULTS); setProviderIdx(-1); setTestResult('idle'); setTestError(''); onClientChanged() }

  const handleTest = async () => {
    setTestResult('idle'); setTestError(''); clearPersistedTestResult(); setTesting(true)
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ llm: form }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) { setTestResult('ok'); persistTestResult('ok') }
      else { setTestResult('fail'); setTestError(data.error ?? '连接失败'); persistTestResult('fail') }
    } catch {
      setTestResult('fail')
      setTestError('网络请求失败，请检查 Base URL')
      persistTestResult('fail')
    } finally { setTesting(false) }
  }

  const resetTest = () => { setTestResult('idle'); setTestError(''); clearPersistedTestResult() }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white shadow-[0_12px_40px_rgba(27,40,34,.1)]">
      <div className="border-b border-line bg-surface-soft px-3 py-2">
        <span className={cn('inline-flex h-[21px] items-center gap-1.5 rounded-lg px-2 text-[10px] font-650 whitespace-nowrap', CHIP_VARIANT[testResult === 'ok' ? 'success' : testResult === 'fail' ? 'danger' : mode.cls])}>
          <i className="size-[6px] flex-none rounded-full bg-current" />{testResult === 'ok' ? '已连接' : testResult === 'fail' ? '连接失败' : mode.label}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-700 text-text-secondary">模型供应商</span>
          <select className={cn(inputCls, 'cursor-pointer')} value={providerIdx} onChange={(e) => { selectProvider(Number(e.target.value)); resetTest() }}>
            <option value={-1}>手动填写</option>
            {PROVIDERS.map((p, i) => (<option key={i} value={i}>{p.label} · {p.model}</option>))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-700 text-text-secondary">Base URL</span>
          <input type="text" className={inputCls} value={form.baseUrl} onChange={(e) => { setForm((f) => ({ ...f, baseUrl: e.target.value })); setProviderIdx(PROVIDERS.findIndex((p) => p.baseUrl === e.target.value)); resetTest() }} placeholder="https://api.openai.com/v1" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-700 text-text-secondary">API Key</span>
          <div className="flex items-center gap-2">
            <input type={showKey ? 'text' : 'password'} className={cn(inputCls, 'flex-1')} value={form.apiKey} onChange={(e) => { setForm((f) => ({ ...f, apiKey: e.target.value })); resetTest() }} placeholder="sk-..." autoComplete="off" />
            <button type="button" className="grid size-8 flex-none place-items-center rounded-lg border border-line-strong bg-white text-text-tertiary hover:bg-surface-hover" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? '隐藏' : '显示'}>
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-700 text-text-secondary">Model</span>
          <input type="text" className={inputCls} value={form.model} onChange={(e) => { setForm((f) => ({ ...f, model: e.target.value })); resetTest() }} placeholder="gpt-5.4-mini" />
        </label>

        {testError && (
          <p className="m-0 rounded-lg border border-danger/15 bg-danger-soft px-3 py-2 text-[12px] text-danger leading-relaxed">{testError}</p>
        )}

        <div className="flex flex-wrap items-center justify-start gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 h-7 rounded-lg border border-line-strong bg-white px-3 text-[11px] font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-50"
            onClick={handleTest}
            disabled={testing || !form.baseUrl.trim() || !form.apiKey.trim() || !form.model.trim()}
          >
            {testing ? <Loader2 size={13} className="animate-spin" /> : testResult === 'ok' ? <CheckCircle size={13} className="text-success" /> : testResult === 'fail' ? <XCircle size={13} className="text-danger" /> : null}
            测试连接
          </button>
          {clientConfigured && <Button variant="secondary" onClick={handleClear}><Trash2 size={13} />清除已保存</Button>}
          <Button variant="primary" onClick={handleSave} disabled={!form.baseUrl.trim() || !form.apiKey.trim() || !form.model.trim()}>保存</Button>
        </div>

        <p className="m-0 text-text-tertiary text-[10px] leading-[1.5]">
          保存后仅存在浏览器本地，请求时经服务端转发到模型。部署成多人服务时请只配服务端 .env.local。
        </p>
      </div>
    </div>
  )
}
