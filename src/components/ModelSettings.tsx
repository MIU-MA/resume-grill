'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Eye, EyeOff, KeyRound, Trash2 } from 'lucide-react'
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

export function ModelSettings({ envConfigured, clientConfigured, onClientChanged }: ModelSettingsProps) {
  const [open, setOpen] = useState(false)
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
    setOpen(false)
  }

  const handleClear = () => {
    clearLlmSettings()
    setForm(DEFAULTS)
    onClientChanged()
  }

  return (
    <div className="my-[18px] overflow-hidden rounded-[4px] border border-line">
      <button type="button" className="flex w-full items-center gap-2 bg-[#fafbfb] px-[13px] py-[10px] transition-[background] duration-[160ms] hover:bg-[#f4f6f7]" onClick={() => setOpen((v) => !v)}>
        <KeyRound size={14} className="text-muted" />
        <strong className="text-[11px] text-[#30373c]">模型设置</strong>
        <span className={cn('inline-flex h-[21px] items-center gap-[5px] rounded-[3px] px-2 text-[9px] font-650 whitespace-nowrap', CHIP_VARIANT[mode.cls])}>
          <i className="size-[6px] flex-none rounded-full bg-current" />{mode.label}
        </span>
        <ChevronDown size={15} className={cn('ml-auto text-[#8a949a] transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="flex flex-col gap-[11px] border-t border-line bg-white p-[13px]">
          <label className="flex flex-col gap-[5px]">
            <span className="text-[9px] font-700 text-[#4e585e]">Base URL</span>
            <input
              type="text"
              className="h-[33px] rounded-[4px] border border-line-strong bg-white px-[11px] text-[11px] text-[#283136] focus:border-brand focus:outline-2 focus:outline-brand focus:outline-offset-[-1px]"
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              placeholder="https://api.openai.com/v1"
            />
          </label>
          <label className="flex flex-col gap-[5px]">
            <span className="text-[9px] font-700 text-[#4e585e]">API Key</span>
            <div className="flex items-center gap-[6px]">
              <input
                type={showKey ? 'text' : 'password'}
                className="h-[33px] flex-1 rounded-[4px] border border-line-strong bg-white px-[11px] text-[11px] text-[#283136] focus:border-brand focus:outline-2 focus:outline-brand focus:outline-offset-[-1px]"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="sk-..."
                autoComplete="off"
              />
              <button type="button" className="grid size-[33px] flex-none place-items-center rounded-[4px] border border-line-strong bg-white text-muted hover:bg-[#f0f3f5]" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? '隐藏' : '显示'}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>
          <label className="flex flex-col gap-[5px]">
            <span className="text-[9px] font-700 text-[#4e585e]">Model</span>
            <input
              type="text"
              className="h-[33px] rounded-[4px] border border-line-strong bg-white px-[11px] text-[11px] text-[#283136] focus:border-brand focus:outline-2 focus:outline-brand focus:outline-offset-[-1px]"
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              placeholder="gpt-4o-mini"
            />
          </label>

          <div className="mt-[2px] flex items-center justify-end gap-2">
            {clientConfigured && (
              <Button variant="secondary" onClick={handleClear}><Trash2 size={13} />清除已保存</Button>
            )}
            <Button variant="primary" onClick={handleSave} disabled={!form.baseUrl.trim() || !form.apiKey.trim() || !form.model.trim()}>保存设置</Button>
          </div>

          <p className="m-0 mt-1 text-faint text-[8px] leading-[1.6]">
            保存后仅存在浏览器本地，请求时经服务端转发到模型。适合个人本地使用，勿在公共设备填写。
            部署成多人服务时请只配服务端 .env.local。
          </p>
        </div>
      )}
    </div>
  )
}
