import { NextResponse } from 'next/server'
import { hasEnvLlm } from '@/providers/openai-compatible'

// 让前端知道服务端是否已配置 env Key，用于显示当前模式（本地 Key / 服务端 Key / 规则示例）。
export async function GET() {
  return NextResponse.json({ envConfigured: hasEnvLlm() })
}
