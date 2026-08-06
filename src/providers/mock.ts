import {
  resumeAnalysisSchema,
  createClaimId,
  type ClaimCategory,
  type MasteryPoint,
  type ResumeAnalysis,
  type ResumeClaim,
} from '@/domain/resume-schema'
import { buildStructuredResumeInput, extractLooseClaimCandidates, extractResumeClaimCandidates } from '@/lib/resume-structure'
import { goalClaimCount, type AnalysisGoal, type ReviewedCandidate } from '@/domain/analysis-config'
import { buildHeuristicJobMatch } from '@/lib/job-match'

const ROLE_RULES: { role: string; keywords: string[] }[] = [
  { role: '前端开发工程师', keywords: ['前端', 'React', 'Vue', 'CSS', 'TypeScript', '页面', 'Vite', 'Next'] },
  { role: '后端开发工程师', keywords: ['后端', 'Java', 'Go', 'Python', '服务端', 'API', 'Spring', '数据库'] },
  { role: '全栈工程师', keywords: ['全栈', '前端', '后端', 'Node', 'React', 'Vue'] },
  { role: '算法工程师', keywords: ['算法', '机器学习', '深度学习', '模型', '推荐', 'NLP'] },
  { role: '产品经理', keywords: ['产品', '需求', '迭代', '用户研究', '原型', 'PRD'] },
  { role: '销售', keywords: ['销售', '客户', '签约', '回款', '渠道', '拜访'] },
  { role: '运营', keywords: ['运营', '拉新', '留存', '转化', '活动', '社群'] },
  { role: '人力资源', keywords: ['招聘', '人力资源', '员工关系', '培训', 'HR', '薪酬'] },
  { role: '数据分析师', keywords: ['数据', '指标', '报表', 'BI', 'SQL', '建模'] },
  { role: '设计师', keywords: ['设计', 'UI', 'UX', '交互', '视觉', '原型'] },
]

const CATEGORY_RULES: { category: ClaimCategory; keywords: string[] }[] = [
  { category: 'metric', keywords: ['万', '用户量', '人数', '团队', '预算', '规模', 'DAU', 'MAU', '亿元', '千万'] },
  { category: 'achievement', keywords: ['提升', '降低', '增长', '减少', '优化', '缩短', '提高', '下降', '节约', '增加', '%'] },
  { category: 'leadership', keywords: ['带领', '管理', '组建', '搭建', '主导', '统筹', '培养', '团队', '负责设计', '建立'] },
  { category: 'responsibility', keywords: ['负责', '主导', '参与', '承担', '牵头', '组织', '推动'] },
  { category: 'skill', keywords: ['熟练', '掌握', '使用', '熟悉', '精通', '运用'] },
]

type MockTemplate = {
  capability: string
  question: string
  masteryPoints: MasteryPoint[]
  traps: string[]
}

const CATEGORY_TEMPLATES: Record<ClaimCategory, MockTemplate> = {
  achievement: {
    capability: '量化成果达成能力',
    question: '这个成果的基线是多少？具体如何计算和验证的？',
    masteryPoints: [
      { point: '说明改造前后的量化指标', dimension: 'context', importance: 'high' },
      { point: '能区分个人与团队的贡献', dimension: 'decision', importance: 'high' },
      { point: '说明指标如何统计与验证', dimension: 'principle', importance: 'high' },
      { point: '说明具体的执行过程', dimension: 'practice', importance: 'medium' },
      { point: '说明方案的限制或副作用', dimension: 'boundary', importance: 'medium' },
    ],
    traps: ['只提结果不提过程', '无法区分个人和团队贡献'],
  },
  responsibility: {
    capability: '职责承担与决策执行能力',
    question: '你说的"负责"具体包括哪些决策？你的决策权到哪里？',
    masteryPoints: [
      { point: '说明具体职责范围和决策权', dimension: 'context', importance: 'high' },
      { point: '说明如何发现和定义问题', dimension: 'decision', importance: 'high' },
      { point: '说明具体的执行过程', dimension: 'practice', importance: 'high' },
      { point: '说明决策带来的实际结果', dimension: 'principle', importance: 'medium' },
      { point: '说明职责与他人职责的边界', dimension: 'boundary', importance: 'medium' },
    ],
    traps: ['只说负责不说具体决策', '描述过于笼统没有细节'],
  },
  metric: {
    capability: '数据统计与归因分析能力',
    question: '这个数字怎么统计出来的？统计口径和周期是什么？',
    masteryPoints: [
      { point: '说明数据的统计方式', dimension: 'practice', importance: 'high' },
      { point: '说明统计口径和时间周期', dimension: 'principle', importance: 'high' },
      { point: '能提供可对比的基准', dimension: 'context', importance: 'high' },
      { point: '说明数据波动的原因', dimension: 'troubleshooting', importance: 'medium' },
      { point: '说明数据的局限性', dimension: 'boundary', importance: 'medium' },
    ],
    traps: ['无法说明统计口径', '没有对比基准说不出好坏'],
  },
  skill: {
    capability: '技术实践与工具掌握能力',
    question: '你在什么场景下、用到什么程度使用它？遇到过什么问题？',
    masteryPoints: [
      { point: '说明具体的使用场景', dimension: 'context', importance: 'high' },
      { point: '说明掌握深度和实际应用', dimension: 'practice', importance: 'high' },
      { point: '说明为什么选择它而非替代', dimension: 'decision', importance: 'high' },
      { point: '说明遇到过的典型问题', dimension: 'troubleshooting', importance: 'medium' },
      { point: '说明它的边界和局限性', dimension: 'boundary', importance: 'medium' },
    ],
    traps: ['只会说工具名不会说使用场景', '不了解替代方案'],
  },
  leadership: {
    capability: '团队管理与组织协调能力',
    question: '你带的是什么样的团队？你在其中做了哪些关键的管理决策？',
    masteryPoints: [
      { point: '说明团队规模和构成', dimension: 'context', importance: 'high' },
      { point: '说明关键管理决策', dimension: 'decision', importance: 'high' },
      { point: '说明管理带来的实际结果', dimension: 'practice', importance: 'high' },
      { point: '说明管理过程中解决的问题', dimension: 'troubleshooting', importance: 'medium' },
      { point: '说明管理方式的局限性', dimension: 'boundary', importance: 'medium' },
    ],
    traps: ['只说管人说不出团队构成', '无法说出具体的管理决策'],
  },
}

const DEFAULT_INTENTS: Record<ClaimCategory, string> = {
  achievement: '验证成果归因和个人贡献占比',
  responsibility: '确认职责深度和决策边界',
  metric: '核实数据口径和统计方式',
  skill: '评估技能掌握程度和实际场景',
  leadership: '了解团队构成和关键管理决策',
}

function detectRole(text: string): string {
  for (const rule of ROLE_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) return rule.role
  }
  return '通用岗位'
}

function detectCategory(sentence: string, sourceSection: string): ClaimCategory {
  if (/技能|技术|专业能力|competenc|skills?/i.test(sourceSection)) return 'skill'
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => sentence.includes(k))) return rule.category
  }
  return 'responsibility'
}

function detectCandidate(text: string): string {
  const identity = buildStructuredResumeInput(text).identity
  const name = identity.find((line) => line.length <= 12 && !/[：:\d@]/.test(line))
  return name || '候选人'
}

function hasNumber(s: string): boolean {
  return /\d/.test(s)
}

function qualityScore(s: string): number {
  let score = 0
  if (hasNumber(s)) score += 4
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => s.includes(k))) score += 3
  }
  if (s.length >= 14 && s.length <= 40) score += 2
  else if (s.length > 60) score -= 1
  return score
}

function goalScore(candidate: ReviewedCandidate, goal: AnalysisGoal): number {
  const text = `${candidate.sourceSection}\n${candidate.content}`
  if (goal === 'project') return /项目|project/i.test(text) ? 8 : 0
  if (goal === 'skills') return /技能|技术|能力|skills?|competenc/i.test(candidate.sourceSection) ? 10 : 0
  if (goal === 'achievement') return /\d|提升|降低|增长|减少|缩短|节约|达成|获得/.test(candidate.content) ? 8 : 0
  if (goal === 'leadership') return /主导|统筹|带领|管理|协调|组织|决策|建立|搭建/.test(candidate.content) ? 8 : 0
  return 0
}

export function mockAnalyze(
  rawText: string,
  sourceFile: string,
  options: { analysisGoal?: AnalysisGoal; candidates?: ReviewedCandidate[]; jobDescription?: string } = {},
): ResumeAnalysis {
  const analysisGoal = options.analysisGoal ?? 'overall'
  const role = detectRole(rawText)
  const candidate = detectCandidate(rawText)
  const structuredCandidates = extractResumeClaimCandidates(rawText)
  const candidates = options.candidates
    ?? (structuredCandidates.length > 0 ? structuredCandidates : extractLooseClaimCandidates(rawText))

  const ranked = candidates
    .map((c) => ({
      candidate: c,
      score: qualityScore(c.content)
        + (/技能|技术|专业能力|competenc|skills?/i.test(c.sourceSection) ? 3 : 0)
        + goalScore(c, analysisGoal),
    }))
    .filter((item) => Boolean(options.candidates) || item.score > 0)
    .sort((a, b) => b.score - a.score)
  const selected = ranked.slice(0, goalClaimCount(analysisGoal))
  const bestSkill = ranked.find((item) => /技能|技术|专业能力|competenc|skills?/i.test(item.candidate.sourceSection))
  if (bestSkill && !selected.includes(bestSkill)) selected[selected.length - 1] = bestSkill
  const finalPool = selected.map((item) => item.candidate)

  const claims: ResumeClaim[] = finalPool.map(({ content, sourceSection }, index) => {
    const category = detectCategory(content, sourceSection)
    const tpl = CATEGORY_TEMPLATES[category]
    const claim = {
      content,
      title: content.length > 14 ? `${content.slice(0, 14)}…` : content,
      category,
      role,
      sourceSection,
      capability: tpl.capability,
      masteryPoints: tpl.masteryPoints,
      initialQuestion: tpl.question,
      initialIntent: DEFAULT_INTENTS[category] ?? '',
      trapPoints: tpl.traps,
      testPriority: 'medium' as const,
    }
    return { ...claim, id: createClaimId(claim, index) }
  })

  if (claims.length === 0) {
    throw new Error('未识别到可验证的经历陈述，请补充具体职责、行动或成果。')
  }

  const analysis: ResumeAnalysis = {
    candidate,
    role,
    sourceFile,
    rawText,
    analysisGoal,
    reviewedCandidates: options.candidates,
    jobDescription: options.jobDescription,
    jobMatch: options.jobDescription ? buildHeuristicJobMatch(options.jobDescription, candidates) : undefined,
    summary: `识别到 ${claims.length} 条可验证声明，岗位倾向「${role}」。未配置模型，以下为规则示例分析。`,
    claims,
  }

  return resumeAnalysisSchema.parse(analysis)
}
