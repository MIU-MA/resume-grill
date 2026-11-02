export type RenderedJobData = { id: string; title: string; description: string }
/** Read public ATS response data; never infer a URL from an opaque record ID. */
export function renderedJobData(value: unknown): RenderedJobData[] {
  const jobs = new Map<string, RenderedJobData>(); let visited = 0
  const visit = (value: unknown, depth: number) => {
    if (++visited > 6000 || depth > 14 || !value || typeof value !== 'object') return
    if (Array.isArray(value)) { value.forEach(item => visit(item, depth + 1)); return }
    const item = value as Record<string, unknown>
    const title = item.jobName ?? item.positionName ?? item.RecruitPostName ?? item.title ?? item.name
    const duties = item.jobDuty ?? item.job_description ?? item.Responsibility ?? item.description
    const requirement = item.jobQualification ?? item.job_requirement ?? item.positionDemand ?? item.Requirement ?? item.requirement
    const id = item.jdId ?? item.positionId ?? item.jobId ?? item.PostId ?? item.id
    if (typeof title === 'string' && title.trim().length >= 2 && title.length <= 120 && (typeof id === 'string' || typeof id === 'number') && typeof duties === 'string' && (typeof requirement === 'string' || item.jobName || item.job_description)) {
      const description = [`岗位职责\n${duties}`, typeof requirement === 'string' && `任职要求\n${requirement}`].filter(Boolean).join('\n\n').slice(0, 12000)
      jobs.set(`${id}:${title}`, { id: String(id), title: title.trim(), description })
    }
    Object.values(item).forEach(child => { if (typeof child === 'object') visit(child, depth + 1) })
  }
  visit(value, 0)
  return [...jobs.values()].slice(0, 100)
}
