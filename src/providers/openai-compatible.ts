import type { ZodType } from 'zod'

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
export async function llmStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: ZodType<T>,
  config?: LlmConfig | null,
): Promise<T> {
  const resolved = config ?? getLlmConfig()
  if (!resolved) {
    throw new Error('LLM 未配置：请在设置中填写 baseUrl / apiKey / model，或在服务端 .env.local 配置环境变量。')
  }

  let res: Response
  try {
    res = await fetch(`${resolved.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resolved.apiKey}`,
      },
      body: JSON.stringify({
        model: resolved.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    })
  } catch {
    // 网络层失败：连接不可达 / Base URL 错误 / 证书问题
    throw new Error(`无法连接模型服务（${resolved.baseUrl}）：请检查 Base URL 是否可达或网络连接。`)
  }

  if (!res.ok) {
    // 模型返回错误：401 鉴权失败（Key 错）/ 429 限流 / 5xx 服务端错误等
    const detail = await res.text()
    throw new Error(`模型请求失败（${res.status}）：${detail.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('模型返回为空')

  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new Error('模型返回不是合法 JSON')
  }

  return schema.parse(parsed)
}
