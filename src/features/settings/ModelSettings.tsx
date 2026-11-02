'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { CheckCircle, Eye, EyeOff, Loader2, Trash2, XCircle } from 'lucide-react'
import { clearLlmSettings, clearTestResult as clearPersistedTestResult, getLlmSettings, setLlmSettings, setTestResult as persistTestResult, type LlmSettings } from '@/lib/settings'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { DEFAULT_MODEL_SETTINGS as DEFAULTS, MODEL_PROVIDERS as PROVIDERS, providerIndex } from './lib/model-presets'

type Mode = { label: string; cls: 'local' | 'env' | 'mock' }

function deriveMode(envConfigured: boolean, clientConfigured: boolean): Mode {
  if (clientConfigured) return { label: '本地 Key', cls: 'local' }
  if (envConfigured) return { label: '服务端 Key', cls: 'env' }
  return { label: '未设置模型', cls: 'mock' }
}

const CHIP_VARIANT: Record<Mode['cls'] | 'success' | 'danger', string> = {
  local: 'text-success bg-success-soft',
  env: 'text-brand bg-brand-soft',
  mock: 'text-warning bg-warning-soft',
  success: 'text-success bg-success-soft',
  danger: 'text-danger bg-danger-soft',
}

type ModelSettingsProps = {
  envConfigured: boolean
  clientConfigured: boolean
  onClientChanged: () => void
  onDirtyChange?: (dirty: boolean) => void
  onBusyChange?: (busy: boolean) => void
}

const inputCls = 'h-8 rounded-none border border-line-strong bg-white px-3 text-label text-text-primary focus:border-brand focus:outline-brand'

export function ModelSettings({ envConfigured, clientConfigured, onClientChanged, onDirtyChange, onBusyChange }: ModelSettingsProps) {
  const [form, setForm] = useState<LlmSettings>(DEFAULTS)
  const [showKey, setShowKey] = useState(false)
  const [providerIdx, setProviderIdx] = useState(0)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'ok' | 'fail'>('idle')
  const [testError, setTestError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [baseline, setBaseline] = useState<LlmSettings>(DEFAULTS)
  const [models, setModels] = useState<string[] | null>(null)
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelMessage, setModelMessage] = useState('')
  const modelRequest = useRef<AbortController | null>(null)
  const modelListId = useId()
  const choices = models ?? PROVIDERS[providerIdx]?.models ?? []

  useEffect(() => {
    const saved = getLlmSettings()
    if (saved) { setForm(saved); setBaseline(saved); setProviderIdx(providerIndex(saved.baseUrl)) }
    return () => modelRequest.current?.abort()
  }, [])
  useEffect(() => { onDirtyChange?.(JSON.stringify(form) !== JSON.stringify(baseline)) }, [form, baseline, onDirtyChange])
  useEffect(() => { onBusyChange?.(testing) }, [testing, onBusyChange])

  const mode = deriveMode(envConfigured, clientConfigured)

  const selectProvider = (idx: number) => {
    resetModels()
    setProviderIdx(idx)
    if (idx >= 0) {
      const p = PROVIDERS[idx]
      setForm((f) => ({ ...f, baseUrl: p.baseUrl, model: p.models[0] ?? '', apiKey: providerIndex(f.baseUrl) === idx ? f.apiKey : '' }))
    }
  }

  const resetModels = () => { modelRequest.current?.abort(); modelRequest.current = null; setModels(null); setModelMessage(''); setLoadingModels(false) }
  const loadModels = async () => {
    modelRequest.current?.abort()
    const controller = new AbortController()
    modelRequest.current = controller
    setLoadingModels(true); setModelMessage('')
    try {
      const response = await fetch('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ baseUrl: form.baseUrl, apiKey: form.apiKey }), signal: controller.signal })
      const data = await response.json()
      if (controller.signal.aborted) return
      if (!response.ok) throw new Error(data.error ?? '未能读取模型列表。')
      if (!Array.isArray(data.models) || data.models.some((model: unknown) => typeof model !== 'string')) throw new Error('模型列表格式不正确，可以手动填写。')
      setModels(data.models)
      setModelMessage(data.models.length ? `已读取 ${data.models.length} 个型号，可在下方选择或输入名称。` : '服务返回了空列表，可以手动填写型号。')
    } catch (error) {
      if (!controller.signal.aborted) setModelMessage(error instanceof Error ? error.message : '未能读取模型列表。')
    } finally { if (!controller.signal.aborted) setLoadingModels(false) }
  }

  const handleSave = () => { setLlmSettings(form); setBaseline(form); setSavedMessage('已保存'); onDirtyChange?.(false); onClientChanged() }

  const handleClear = () => { resetModels(); clearLlmSettings(); clearPersistedTestResult(); setForm(DEFAULTS); setBaseline(DEFAULTS); setProviderIdx(0); setTestResult('idle'); setTestError(''); setSavedMessage('已清除'); onClientChanged() }

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

  const resetTest = () => { setSavedMessage(''); setTestResult('idle'); setTestError(''); clearPersistedTestResult() }

  return (
    <div className="overflow-hidden border border-line bg-white">
      <div className="border-b border-line bg-surface-soft px-3 py-2">
        <span className={cn('inline-flex h-[21px] items-center gap-1.5 rounded-lg px-2 text-aux font-650 whitespace-nowrap', CHIP_VARIANT[testResult === 'ok' ? 'success' : testResult === 'fail' ? 'danger' : mode.cls])}>
          <i className="size-[6px] flex-none rounded-full bg-current" />{testResult === 'ok' ? '已连接' : testResult === 'fail' ? '连接失败' : mode.label}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <label className="flex flex-col gap-1">
          <span className="text-label font-700 text-text-secondary">模型供应商</span>
          <select className={cn(inputCls, 'cursor-pointer')} value={providerIdx} disabled={testing} onChange={(e) => { selectProvider(Number(e.target.value)); resetTest() }}>
            <option value={-1}>手动填写</option>
            {PROVIDERS.map((p, i) => (<option key={p.baseUrl} value={i}>{p.label}</option>))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label font-700 text-text-secondary">Base URL</span>
          <input type="text" className={inputCls} disabled={testing} value={form.baseUrl} onChange={(e) => { resetModels(); setForm((f) => ({ ...f, baseUrl: e.target.value })); setProviderIdx(providerIndex(e.target.value)); resetTest() }} placeholder="https://api.openai.com/v1" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-label font-700 text-text-secondary">API Key</span>
          <div className="flex items-center gap-2">
            <input type={showKey ? 'text' : 'password'} className={cn(inputCls, 'min-w-0 flex-1')} disabled={testing} value={form.apiKey} onChange={(e) => { resetModels(); setForm((f) => ({ ...f, apiKey: e.target.value })); resetTest() }} placeholder="sk-..." autoComplete="off" />
            <button type="button" className="grid size-8 flex-none place-items-center rounded-lg border border-line-strong bg-white text-text-tertiary hover:bg-surface-hover" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? '隐藏' : '显示'}>
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </label>
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2"><label htmlFor={modelListId} className="text-label font-700 text-text-secondary">模型型号</label><button type="button" className="text-label text-text-secondary underline disabled:opacity-50" disabled={loadingModels || testing || !form.apiKey.trim() || !form.baseUrl.trim()} onClick={() => void loadModels()}>{loadingModels ? '正在读取…' : '读取可用模型'}</button></div>
          {choices.length > 0 && <select id={choices.includes(form.model) ? modelListId : undefined} aria-label="选择模型型号" className={inputCls} disabled={testing} value={choices.includes(form.model) ? form.model : ''} onChange={event => { setForm(f => ({ ...f, model: event.target.value })); resetTest() }}><option value="">手动填写型号</option>{choices.map(model => <option key={model} value={model}>{model}</option>)}</select>}
          {(!choices.length || !choices.includes(form.model)) && <input id={modelListId} type="text" className={inputCls} disabled={testing} value={form.model} onChange={(e) => { setForm((f) => ({ ...f, model: e.target.value })); resetTest() }} placeholder="填写服务提供的模型 ID" />}
          {modelMessage && <p role="status" className="my-1 text-body leading-relaxed text-text-secondary">{modelMessage}</p>}
          <p className="m-0 text-meta leading-relaxed text-text-tertiary">列表读取不会生成内容。请选择支持文字对话和 JSON 输出的型号；测试连接会实际调用模型。</p>
        </div>

        {testError && (
          <p className="m-0 rounded-lg border border-danger/15 bg-danger-soft px-3 py-2 text-body text-danger leading-relaxed">{testError}</p>
        )}

        {savedMessage && <p role="status" className="m-0 text-label text-success">{savedMessage}</p>}
        <div className="flex flex-wrap items-center justify-start gap-2">
          <button
            type="button"
            className="flex items-center gap-1.5 h-7 rounded-lg border border-line-strong bg-white px-3 text-label font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-50"
            onClick={handleTest}
            disabled={testing || !form.baseUrl.trim() || !form.apiKey.trim() || !form.model.trim()}
          >
            {testing ? <Loader2 size={13} className="animate-spin" /> : testResult === 'ok' ? <CheckCircle size={13} className="text-success" /> : testResult === 'fail' ? <XCircle size={13} className="text-danger" /> : null}
            测试连接
          </button>
          {clientConfigured && <Button variant="secondary" onClick={handleClear}><Trash2 size={13} />清除已保存</Button>}
          <Button variant="primary" onClick={handleSave} disabled={!form.baseUrl.trim() || !form.apiKey.trim() || !form.model.trim()}>保存</Button>
        </div>

        <p className="m-0 text-text-tertiary text-meta leading-[1.5]">
          Key 保存在此浏览器。请求会经工作台发送到你选择的模型。
        </p>
      </div>
    </div>
  )
}
