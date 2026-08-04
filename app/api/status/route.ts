import { NextResponse } from 'next/server'
import { hasEnvLlm } from '@/providers/openai-compatible'

export async function GET() {
  return NextResponse.json({ envConfigured: hasEnvLlm() })
}
