'use client'

import { useEffect, useState } from 'react'
import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { clearLlmSettings, getLlmSettings, setLlmSettings, type LlmSettings } from '@/lib/settings'
import { Button } from '@/components/Button'
import { cn } from '@/lib/cn'

const DEFAULTS: LlmSettings = { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' }

type Mode = { label: string; cls: 'local' | 'env' | 'mock' }

function deriveMode(envConfigured: boolean, clientConfigured: boolean): Mode {
  if (clientConfigured) return { label: '本地 Key', cls: 'local' }
  if (envConfigured) return { label: '服务端 Key', cls: 'env' }
  return { label: '规则示例', cls: 'mock' }
}

const CHIP_VARIANT: Record<Mode['cls'], string> = {
  local: 'text-[#1e6545] bg-green-soft',
  env: 'text-brand bg-brand-soft',
  mock: 'text-[#8a7440] bg-[#f3efe3]',
}

type ModelSettingsProps = {
  envConfigured: boolean
  clientConfigured: boolean
  onClientChanged: () => void
}

// text-field 复用样式
const inputCls = 'h-8 rounded-[4px] border border-line-strong bg-white px-[11px] text-[11px] text-[#283136] focus:border-brand focus:outline-brand'

export function ModelSettings({ envConfigured, clientConfigured, onClientChanged }: ModelSettingsProps) {
  const [form, setForm] = useState<LlmSettings>(DEFAULTS)
  const [showKey, setShowKey] = useState(false)

  useEffect(() => {
    const saved = getLlmSettings()
    if (saved) setForm(saved)
  }, [])

  const mode = deriveMode(envConfigured, clientConfigured)

  const handleSave = () => {
    setLlmSettings(form)
    onClientChanged()
  }

  const handleClear = () => {
    clearLlmSettings()
    setForm(DEFAULTS)
    onClientChanged()
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white shadow-[0_12px_40px_rgba(27,40,34,.1)]">
      <div className="border-b border-line bg-[#fafbfb] px-3 py-2">
        <span className={cn('inline-flex h-[21px] items-center gap-[5px] rounded-[3px] px-2 text-[9px] font-650 whitespace-nowrap', CHIP_VARIANT[mode.cls])}>
          <i className="size-[6px] flex-none rounded-full bg-current" />{mode.label}
        </span>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-700 text-[#4e585e]">Base URL</span>
          <input type="text" className={inputCls} value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} placeholder="https://api.openai.com/v1" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-700 text-[#4e585e]">API Key</span>
          <div className="flex items-center gap-1.5">
            <input type={showKey ? 'text' : 'password'} className={cn(inputCls, 'flex-1')} value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} placeholder="sk-..." autoComplete="off" />
            <button type="button" className="grid size-8 flex-none place-items-center rounded-[4px] border border-line-strong bg-white text-muted hover:bg-[#f0f3f5]" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? '隐藏' : '显示'}>
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-700 text-[#4e585e]">Model</span>
          <input type="text" className={inputCls} value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="gpt-4o-mini" />
        </label>

        <div className="flex items-center justify-end gap-2">
          {clientConfigured && <Button variant="secondary" onClick={handleClear}><Trash2 size={13} />清除已保存</Button>}
          <Button variant="primary" onClick={handleSave} disabled={!form.baseUrl.trim() || !form.apiKey.trim() || !form.model.trim()}>保存</Button>
        </div>

        <p className="m-0 text-faint text-[8px] leading-[1.5]">
          保存后仅存在浏览器本地，请求时经服务端转发到模型。部署成多人服务时请只配服务端 .env.local。
        </p>
      </div>
    </div>
  )
}
