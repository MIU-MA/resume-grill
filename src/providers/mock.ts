import {
  resumeAnalysisSchema,
  createClaimId,
  type ClaimCategory,
  type ResumeAnalysis,
  type ResumeClaim,
  type RiskLevel,
} from '@/domain/resume-schema'
import { buildStructuredResumeInput, extractLooseClaimCandidates, extractResumeClaimCandidates } from '@/lib/resume-structure'
import type { AnalysisGoal, ReviewedCandidate } from '@/domain/analysis-config'
import { buildHeuristicJobMatch } from '@/lib/job-match'

// 当未配置模型时使用：不真正理解语义，但从上传文本中抽取真实句子作为声明，
// 让无 Key 演示也能反映候选人、岗位与文件名的真实变化。
// 配置模型后此路径不再触发。

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
  {
    category: 'achievement',
    keywords: ['提升', '降低', '增长', '减少', '优化', '缩短', '提高', '下降', '节约', '增加', '%'],
  },
  { category: 'leadership', keywords: ['带领', '管理', '组建', '搭建', '主导', '统筹', '培养', '团队', '负责设计', '建立'] },
  { category: 'responsibility', keywords: ['负责', '主导', '参与', '承担', '牵头', '组织', '推动'] },
  { category: 'skill', keywords: ['熟练', '掌握', '使用', '熟悉', '精通', '运用'] },
]

const CATEGORY_TEMPLATES: Record<
  ClaimCategory,
  { gaps: string[]; question: string; points: string[]; followUps: string[] }
> = {
  achievement: {
    gaps: ['改造前的基线数据', '个人贡献与团队贡献的区分', '指标的统计口径与时间窗口'],
    question: '这个成果的基线是多少？具体如何计算的？',
    points: ['说明改造前后的量化指标', '区分个人与团队的贡献', '说明指标如何统计与验证'],
    followUps: ['你个人贡献和团队贡献分别占多少？', '这个指标的统计口径是什么？', '如果没有你，这个结果是否仍会发生？'],
  },
  responsibility: {
    gaps: ['具体负责的决策范围', '与他人职责的边界', '决策带来的影响'],
    question: '“负责”具体包括哪些决策？你的决策权到哪里？',
    points: ['说明具体职责范围', '说明如何发现问题', '说明决策带来的结果'],
    followUps: ['你负责的关键决策有哪些？', '和别人职责的边界在哪？', '上线后用什么验证效果？'],
  },
  metric: {
    gaps: ['规模的统计方式', '规模对应的周期', '同行业可比基准'],
    question: '这个数字的统计口径是什么？覆盖多长时间？',
    points: ['说明规模如何统计', '说明对应的时间周期', '提供可对比的基准'],
    followUps: ['这个规模怎么统计出来的？', '和同行业相比处于什么水平？', '规模背后的关键驱动是什么？'],
  },
  skill: {
    gaps: ['使用深度与场景', '遇到过的典型问题', '为什么选它而非替代方案'],
    question: '你在什么场景下、用到什么程度使用它？',
    points: ['说明具体使用场景', '说明掌握的深度', '举一个遇到的典型问题'],
    followUps: ['遇到过什么典型问题？怎么解决的？', '为什么选择它而不是替代方案？', '它的边界和局限是什么？'],
  },
  leadership: {
    gaps: ['团队规模与构成', '你的管理决策', '管理带来的结果'],
    question: '你带的是什么样的团队？你在其中做了哪些管理决策？',
    points: ['说明团队规模与构成', '说明关键管理决策', '说明管理带来的结果'],
    followUps: ['团队多大？怎么分工的？', '你做过哪些关键的管理决策？', '管理前后团队有什么变化？'],
  },
}

const DEFAULT_INTENTS: Record<ClaimCategory, string> = {
  achievement: '验证成果真实性和个人贡献占比',
  responsibility: '确认职责深度和决策边界',
  metric: '核实数据口径和统计方式',
  skill: '评估技能掌握程度和实际场景',
  leadership: '了解团队构成和关键管理决策',
}

const CATEGORY_TRAP_MAP: Record<ClaimCategory, string[]> = {
  achievement: ['只提结果不提过程', '无法区分个人和团队贡献'],
  responsibility: ['只说负责不说具体的决策', '描述过于笼统'],
  metric: ['无法说明统计口径', '没有对比基准'],
  skill: ['只会说工具名不会说使用场景', '不了解替代方案'],
  leadership: ['只说管理团队不说团队构成', '无法说明管理决策'],
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

function extractMetrics(content: string): string[] {
  return [...new Set(content.match(/\d+(?:\.\d+)?\s*(?:%|万\+?|亿|人|元|秒|分钟|小时|天|fps|ms|条|个|次|倍)/gi) ?? [])]
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

function riskFor(category: ClaimCategory, numbered: boolean): { exaggerationRisk: RiskLevel; interviewRisk: RiskLevel } {
  const map: Record<ClaimCategory, { exag: RiskLevel; intv: RiskLevel }> = {
    achievement: numbered ? { exag: 'medium', intv: 'high' } : { exag: 'low', intv: 'medium' },
    metric: numbered ? { exag: 'medium', intv: 'high' } : { exag: 'low', intv: 'medium' },
    leadership: { exag: 'medium', intv: 'high' },
    responsibility: { exag: 'low', intv: 'medium' },
    skill: { exag: 'low', intv: 'medium' },
  }
  return { exaggerationRisk: map[category].exag, interviewRisk: map[category].intv }
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
    .map((candidate) => ({
      candidate,
      score: qualityScore(candidate.content)
        + (/技能|技术|专业能力|competenc|skills?/i.test(candidate.sourceSection) ? 3 : 0)
        + goalScore(candidate, analysisGoal),
    }))
    .filter((item) => Boolean(options.candidates) || item.score > 0)
    .sort((a, b) => b.score - a.score)
  const selected = ranked.slice(0, 6)
  const bestSkill = ranked.find((item) => /技能|技术|专业能力|competenc|skills?/i.test(item.candidate.sourceSection))
  if (bestSkill && !selected.includes(bestSkill)) selected[selected.length - 1] = bestSkill
  const finalPool = selected.map((item) => item.candidate)

  const claims: ResumeClaim[] = finalPool.map(({ content, sourceSection }, index) => {
    const category = detectCategory(content, sourceSection)
    const tpl = CATEGORY_TEMPLATES[category]
    const r = riskFor(category, hasNumber(content))
    const metrics = extractMetrics(content)
    const claim = {
      content,
      title: content.length > 14 ? `${content.slice(0, 14)}…` : content,
      category,
      role,
      sourceSection,
      exaggerationRisk: r.exaggerationRisk,
      interviewRisk: r.interviewRisk,
      evidence: metrics.length > 0 ? [`原文给出的量化信息：${metrics.join('、')}`] : [],
      evidenceGap: tpl.gaps,
      initialQuestion: tpl.question,
      initialIntent: DEFAULT_INTENTS[category] ?? '',
      evaluationPoints: tpl.points,
      verifyPoints: tpl.points.map((point, i) => ({
        point,
        importance: (i === 0 ? 'high' : 'medium') as 'high' | 'medium' | 'low',
      })),
      trapPoints: CATEGORY_TRAP_MAP[category] ?? [],
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
