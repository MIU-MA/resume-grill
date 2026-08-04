import type { ZodType } from 'zod'
import { assertAllowedBaseUrl } from '@/lib/url-guard'

export type LlmConfig = {
  baseUrl: string
  apiKey: string
  model: string
}

// 服务端环境变量（部署场景）：API Key 只在服务端读取，绝不下发浏览器。
export function getLlmConfig(): LlmConfig | null {
  const baseUrl = process.env.OPENAI_BASE_URL
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL
  if (!baseUrl || !apiKey || !model) return null
  return { baseUrl, apiKey, model }
}

export function hasEnvLlm(): boolean {
  return getLlmConfig() !== null
}

// 合并服务端 env 与客户端传入设置：客户端优先（个人本地场景），缺则回落 env（部署场景）。
// 客户端传入的 Key 仍经服务端 Route Handler 转发到模型，浏览器不直连模型 API。
export function resolveLlmConfig(client?: { baseUrl?: string; apiKey?: string; model?: string } | null): LlmConfig | null {
  if (client && client.baseUrl && client.apiKey && client.model) {
    return { baseUrl: client.baseUrl, apiKey: client.apiKey, model: client.model }
  }
  return getLlmConfig()
}

// 调用 OpenAI 兼容接口并按 schema 校验结构化输出。
// options.signal 控制超时；options.maxTokens 限制输出长度，避免超长回答拉高费用。
export async function llmStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: ZodType<T>,
  config?: LlmConfig | null,
  options?: { signal?: AbortSignal; maxTokens?: number },
): Promise<T> {
  const resolved = config ?? getLlmConfig()
  if (!resolved) {
    throw new Error('LLM 未配置：请在设置中填写 baseUrl / apiKey / model，或在服务端 .env.local 配置环境变量。')
  }

  // SSRF 防护：拒绝内网/保留地址与未授权白名单外的 Base URL（服务端 fetch 前拦截）。
  await assertAllowedBaseUrl(resolved.baseUrl)

  const body: Record<string, unknown> = {
    model: resolved.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  }
  if (options?.maxTokens) body.max_tokens = options.maxTokens

  let res: Response
  try {
    res = await fetch(`${resolved.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resolved.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('模型请求超时，请稍后重试或缩短输入。')
    }
    // 网络层失败：连接不可达 / Base URL 错误 / 证书问题
    throw new Error(`无法连接模型服务（${resolved.baseUrl}）：请检查 Base URL 是否可达或网络连接。`)
  }

  if (!res.ok) {
    // 模型返回错误：401 鉴权失败（Key 错）/ 429 限流 / 5xx 服务端错误等
    const detail = await res.text()
    throw new Error(`模型请求失败（${res.status}）：${detail.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{
      finish_reason?: string
      text?: string
      message?: { content?: string | Array<{ type?: string; text?: string }>; reasoning_content?: string }
    }>
  }
  const choice = data.choices?.[0]
  // 推理模型（DeepSeek-R1/V3/V4）输出在 reasoning_content，content 可能为空
  const content = normalizeMessageContent(choice?.message?.content) || normalizeMessageContent(choice?.message?.reasoning_content) || choice?.text
  if (!content) throw new Error('模型返回为空')

  let parsed: unknown
  try {
    parsed = parseModelJson(content)
  } catch {
    if (choice?.finish_reason === 'length') {
      throw new Error('模型输出因长度限制被截断，请重试或提高模型的最大输出长度。')
    }
    throw new Error('模型返回不是合法 JSON，请确认所选模型支持 JSON 输出。')
  }

  const validated = schema.safeParse(parsed)
  if (!validated.success) {
    const issue = validated.error.issues[0]
    const path = issue?.path.length ? issue.path.join('.') : '根对象'
    throw new Error(`模型 JSON 字段不完整：${path} ${issue?.message ?? '格式不符合要求'}`)
  }
  return validated.data
}

function normalizeMessageContent(content: string | Array<{ type?: string; text?: string }> | undefined): string {
  if (typeof content === 'string') return content.trim()
  if (!Array.isArray(content)) return ''
  return content.map((part) => part.text ?? '').join('').trim()
}

export function parseModelJson(content: string): unknown {
  const trimmed = content.trim().replace(/^﻿/, '')
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  for (const candidate of [trimmed, fenced]) {
    if (!candidate) continue
    try {
      return JSON.parse(candidate)
    } catch {
      // Some compatible APIs ignore response_format and wrap JSON in prose.
    }
  }

  for (let index = 0; index < trimmed.length; index++) {
    if (trimmed[index] !== '{' && trimmed[index] !== '[') continue
    const candidate = readBalancedJson(trimmed, index)
    if (!candidate) continue
    try {
      return JSON.parse(candidate)
    } catch {
      // Keep searching in case an earlier brace came from explanatory prose.
    }
  }
  throw new Error('No valid JSON object found')
}

function readBalancedJson(value: string, start: number): string | null {
  const stack: string[] = []
  let inString = false
  let escaped = false

  for (let index = start; index < value.length; index++) {
    const char = value[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{' || char === '[') stack.push(char)
    else if (char === '}' || char === ']') {
      const opening = stack.pop()
      if ((char === '}' && opening !== '{') || (char === ']' && opening !== '[')) return null
      if (stack.length === 0) return value.slice(start, index + 1)
    }
  }
  return null
}
