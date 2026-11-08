export type JobPreparationIntent = 'diagnosis' | 'interview'
export type JobPreparationRequest = {
  job: { id: string; company: string; role: string; sourceUrl: string; jobDescription: string; interviewKind?: import('./interview-strategy').InterviewKind }
  attachment: File
  attachmentSource?: { id: string; updatedAt: number }
}
