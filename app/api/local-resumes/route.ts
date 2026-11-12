import { proxyResumeSnapshot } from '@/lib/workbench-proxy'

export const runtime = 'nodejs'
export const GET = (request: Request) => proxyResumeSnapshot(request)
export const POST = (request: Request) => proxyResumeSnapshot(request)
