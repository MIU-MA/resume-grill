'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Eye, EyeOff, KeyRound, Trash2 } from 'lucide-react'
import { clearLlmSettings, getLlmSettings, setLlmSettings, type LlmSettings } from '@/lib/settings'

const DEFAULTS: LlmSettings = { baseUrl: 'https://api.openai.com/v1', apiKey: '', model: 'gpt-4o-mini' }

type Mode = { label: string; cls: 'local' | 'env' | 'mock' }

function deriveMode(envConfigured: boolean, clientConfigured: boolean): Mode {
  if (clientConfigured) return { label: '本地 Key', cls: 'local' }
  if (envConfigured) return { label: '服务端 Key', cls: 'env' }
  return { label: '规则示例', cls: 'mock' }
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

  // 仅在浏览器端读取已保存设置，避免 SSR/hydration 不一致。
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
    <div className="model-settings">
      <button type="button" className="ms-head" onClick={() => setOpen((v) => !v)}>
        <KeyRound size={14} />
        <strong>模型设置</strong>
        <span className={`mode-chip ${mode.cls}`}><i />{mode.label}</span>
        <ChevronDown size={15} className={open ? 'rotate' : ''} />
      </button>

      {open && (
        <div className="ms-body">
          <label className="ms-field">
            <span>Base URL</span>
            <input
              type="text"
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              placeholder="https://api.openai.com/v1"
            />
          </label>
          <label className="ms-field">
            <span>API Key</span>
            <div className="ms-key-row">
              <input
                type={showKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder="sk-..."
                autoComplete="off"
              />
              <button type="button" className="ms-eye" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? '隐藏' : '显示'}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </label>
          <label className="ms-field">
            <span>Model</span>
            <input
              type="text"
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              placeholder="gpt-4o-mini"
            />
          </label>

          <div className="ms-actions">
            {clientConfigured && (
              <button type="button" className="button secondary" onClick={handleClear}><Trash2 size={13} />清除已保存</button>
            )}
            <button
              type="button"
              className="button primary"
              onClick={handleSave}
              disabled={!form.baseUrl.trim() || !form.apiKey.trim() || !form.model.trim()}
            >保存设置</button>
          </div>

          <p className="ms-hint">
            保存后仅存在浏览器本地，请求时经服务端转发到模型。适合个人本地使用，勿在公共设备填写。
            部署成多人服务时请只配服务端 .env.local。
          </p>
        </div>
      )}
    </div>
  )
}
