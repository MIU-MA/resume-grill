export const RESUME_TEMPLATES = [
  { id: 'meowth', name: 'Meowth', description: '砖红分节 · 经历分栏' },
  { id: 'brilliant', name: 'Brilliant', description: '蓝色标题 · 层次分明' },
  { id: 'persian', name: 'Persian', description: '黑白居中 · 正式简洁' },
  { id: 'typst', name: '中文 Typst', description: '日期侧列 · 蓝色横线' },
  { id: 'classic', name: '经典居中', description: '居中抬头 · 清晰分节' },
  { id: 'modern', name: '蓝色线条', description: '左对齐 · 蓝色强调' },
  { id: 'sidebar', name: '侧栏标题', description: '标题分栏 · 留白有序' },
  { id: 'compact', name: '紧凑排版', description: '小间距 · 容纳更多经历' },
] as const
export type ResumeTemplateId = typeof RESUME_TEMPLATES[number]['id'] | 'original'
export const DEFAULT_RESUME_TEMPLATE: ResumeTemplateId = 'classic'
export function resumeTemplateId(value: unknown): ResumeTemplateId {
  return value === 'original' || RESUME_TEMPLATES.some(template => template.id === value) ? value as ResumeTemplateId : DEFAULT_RESUME_TEMPLATE
}
