export const APPLICATION_STAGES = {
  awaiting: '等待回复', replied: '收到回复', interview: '已约面试', next_round: '进入下一轮',
  rejected: '未通过', offer: '收到 Offer', withdrawn: '已结束跟进',
} as const
export type ApplicationStage = keyof typeof APPLICATION_STAGES
/** Queued or failed mail must not appear as a completed application awaiting reply. */
export function applicationStage(progress: ApplicationProgress | undefined, delivery: string): ApplicationStage | undefined {
  return progress?.stage ?? (delivery === 'website' || delivery === 'sent' ? 'awaiting' : undefined)
}
export type ApplicationProgress = {
  interviewKind?: import('./interview-strategy').InterviewKind
  stage: ApplicationStage
  contact: string
  interviewAt: string
  nextAction: string
  followUpAt: string
  note: string
  events: Array<{ stage: ApplicationStage; at: number }>
  interviews: Array<{ id: string; title: string; at: string; notes: string }>
  updatedAt: number
}
export function emptyApplicationProgress(): ApplicationProgress {
  return { stage: 'awaiting', contact: '', interviewAt: '', nextAction: '', followUpAt: '', note: '', events: [], interviews: [], updatedAt: 0 }
}
export function changeApplicationProgress(previous: ApplicationProgress | undefined, changes: Partial<Omit<ApplicationProgress, 'events' | 'updatedAt'>>, now: number): ApplicationProgress {
  const value = previous ?? emptyApplicationProgress()
  return { ...value, ...changes, updatedAt: now, events: changes.stage && changes.stage !== value.stage ? [...value.events, { stage: changes.stage, at: now }] : value.events }
}
