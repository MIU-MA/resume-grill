// Model IDs checked against official catalogs on 2026-11-02. Live /models takes precedence.
export const MODEL_PROVIDERS = [
  { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-6-luna', 'gpt-6.1-terra', 'gpt-6.1-sol', 'gpt-6-astra'] },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-flash', 'deepseek-v4-pro'] },
  { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen3.8-flash', 'qwen3.7-plus', 'qwen3.8-max'] },
  { label: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-5.3-flash', 'glm-5.3', 'glm-5.3-flashx'] },
  { label: 'MiniMax', baseUrl: 'https://api.minimax.cn/v1', models: ['MiniMax-M3.1-Flash', 'MiniMax-M3'] },
  { label: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', models: ['kimi-k3.1-pro', 'kimi-k3', 'kimi-k2.6'] },
  { label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', models: ['gemini-3.8-flash', 'gemini-3.5-flash'] },
  { label: '硅基流动', baseUrl: 'https://api.siliconflow.cn/v1', models: [] },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', models: [] },
]

export const DEFAULT_MODEL_SETTINGS = { baseUrl: MODEL_PROVIDERS[0].baseUrl, apiKey: '', model: MODEL_PROVIDERS[0].models[0] }
export const providerIndex = (baseUrl: string) => MODEL_PROVIDERS.findIndex(provider => provider.baseUrl === baseUrl.trim().replace(/\/+$/, ''))
