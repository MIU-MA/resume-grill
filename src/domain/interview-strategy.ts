export const INTERVIEW_KINDS = { technical: '技术面', architecture: '架构面', project: '项目面', hr: 'HR 面' } as const
export type InterviewKind = keyof typeof INTERVIEW_KINDS
export const INTERVIEW_GUIDANCE: Record<InterviewKind, string> = {
  technical: '优先考察原理、实现、边界和排错，按用户真实技术栈提问。',
  architecture: '优先讨论约束、方案取舍、可靠性、演进与失败场景。不假设用户承担过未提供的系统规模。',
  project: '优先追问个人职责、关键决策、协作和结果证据。缺少数字时问如何观察效果，不要求编造数字。',
  hr: '优先讨论求职动机、岗位理解、沟通协作与职业选择，不把技术细节题作为主线。不推断个人隐私。',
}
