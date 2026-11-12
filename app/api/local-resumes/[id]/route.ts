import { proxyResumeSnapshot } from '@/lib/workbench-proxy'

export const runtime = 'nodejs'
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return proxyResumeSnapshot(request, (await context.params).id)
}
