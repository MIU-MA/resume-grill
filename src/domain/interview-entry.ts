import type { InterviewSession } from '@/domain/interview-schema'

type ActiveInterview = {
  activeClaimSnapshot: { id: string } | null
  currentQuestion: string
  done: boolean
}

type InterviewEntry =
  | { action: 'continue' }
  | { action: 'restore'; session: InterviewSession }
  | { action: 'start'; version: number }

/** Preserve the live answer before considering a persisted session. */
export function getInterviewEntry(
  claimId: string,
  sessions: InterviewSession[],
  active: ActiveInterview,
): InterviewEntry {
  if (active.activeClaimSnapshot?.id === claimId && !active.done && active.currentQuestion) {
    return { action: 'continue' }
  }

  const unfinished = sessions.reduce<InterviewSession | undefined>((latest, session) => {
    if (session.status !== 'in_progress') return latest
    return !latest || session.version > latest.version ? session : latest
  }, undefined)
  if (unfinished) return { action: 'restore', session: unfinished }

  return {
    action: 'start',
    version: sessions.reduce((latest, session) => Math.max(latest, session.version), 0) + 1,
  }
}
