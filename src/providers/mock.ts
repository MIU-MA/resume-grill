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
    capability: '结果是怎么做出来的',
    question: '为了得到这个结果，你具体改了哪一处？',
    masteryPoints: [
      { point: '改之前和改之后有什么变化', dimension: 'context', importance: 'high' },
      { point: '哪部分是你做的', dimension: 'decision', importance: 'high' },
      { point: '这个数字是怎么算的', dimension: 'principle', importance: 'high' },
      { point: '具体改了什么，怎么做的', dimension: 'practice', importance: 'medium' },
      { point: '这样做有什么代价', dimension: 'boundary', importance: 'medium' },
    ],
    traps: ['只提结果不提过程', '无法区分个人和团队贡献'],
  },
  responsibility: {
    capability: '你具体负责了什么',
    question: '这段工作里，哪一部分是你独立完成的？',
    masteryPoints: [
      { point: '负责哪部分，哪些事由你决定', dimension: 'context', importance: 'high' },
      { point: '当时为什么要做这件事', dimension: 'decision', importance: 'high' },
      { point: '举一件你实际完成的工作', dimension: 'practice', importance: 'high' },
      { point: '做完后解决了什么问题', dimension: 'principle', importance: 'medium' },
      { point: '和同事是怎么分工的', dimension: 'boundary', importance: 'medium' },
    ],
    traps: ['只说负责不说具体决策', '描述过于笼统没有细节'],
  },
  metric: {
    capability: '简历里的数字从哪来',
    question: '简历里的这个数字，是怎么统计出来的？',
    masteryPoints: [
      { point: '数据是从哪里取的', dimension: 'practice', importance: 'high' },
      { point: '算了哪些数据、多长时间', dimension: 'principle', importance: 'high' },
      { point: '是和什么结果比较的', dimension: 'context', importance: 'high' },
      { point: '数据变化还有哪些原因', dimension: 'troubleshooting', importance: 'medium' },
      { point: '这个数字不能说明什么', dimension: 'boundary', importance: 'medium' },
    ],
    traps: ['没说清怎么算的', '只报数字，没有前后对比'],
  },
  skill: {
    capability: '技术在项目里怎么用',
    question: '从这里挑一项，说说你最近一次用它做了什么。',
    masteryPoints: [
      { point: '在哪个项目里用过', dimension: 'context', importance: 'high' },
      { point: '用它具体做了什么', dimension: 'practice', importance: 'high' },
      { point: '为什么选它，有没有比较过别的方案', dimension: 'decision', importance: 'high' },
      { point: '遇到过什么问题，后来怎么解决', dimension: 'troubleshooting', importance: 'medium' },
      { point: '什么情况下不适合用它', dimension: 'boundary', importance: 'medium' },
    ],
    traps: ['只会说工具名不会说使用场景', '不了解替代方案'],
  },
  leadership: {
    capability: '怎么分工和推进工作',
    question: '推进这件事时，你做过什么需要和别人商量的决定？',
    masteryPoints: [
      { point: '有哪些人参与，各自负责什么', dimension: 'context', importance: 'high' },
      { point: '你做了什么决定，为什么', dimension: 'decision', importance: 'high' },
      { point: '最后工作完成得怎么样', dimension: 'practice', importance: 'high' },
      { point: '意见不一致时怎么处理', dimension: 'troubleshooting', importance: 'medium' },
      { point: '哪些事情需要别人配合', dimension: 'boundary', importance: 'medium' },
    ],
    traps: ['只说协调，没有具体经过', '没说清自己的决定'],
  },
}

const DEFAULT_INTENTS: Record<ClaimCategory, string> = {
  achievement: '结果写出来了，还需要讲清你是怎么做到的',
  responsibility: '“负责”范围很大，需要说清你实际做了什么',
  metric: '需要知道这个数字从哪来、怎么算的',
  skill: '列出的技术需要有具体用法可以讲',
  leadership: '需要结合一件具体的事，讲清你怎么和别人合作',
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
    throw new Error('没找到可以练习的经历，请补充一段你做过的工作或项目。')
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
    summary: `选出了 ${claims.length} 条练习内容。这是免费示例，问题由固定规则生成，未调用模型。`,
    claims,
  }

  return resumeAnalysisSchema.parse(analysis)
}
