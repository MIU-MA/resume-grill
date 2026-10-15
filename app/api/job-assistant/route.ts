import { handleAssistantRequest } from '@/features/job-assistant/lib/assistant-api'

export const runtime = 'nodejs'
export const maxDuration = 120
export const POST = handleAssistantRequest
