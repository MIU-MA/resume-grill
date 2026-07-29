import {
  resumeAnalysisSchema,
  type ClaimCategory,
  type ResumeAnalysis,
  type ResumeClaim,
} from '@/domain/resume-schema'
import { nextQuestionSchema, type InterviewTurn, type NextQuestion } from '@/domain/interview-schema'

// 当未配置模型时使用：不真正理解语义，但从上传文本中抽取真实句子作为声明，
// 让无 Key 演示也能反映候选人、岗位与文件名的真实变化。
// 配置模型后此路径不再触发。

const ROLE_RULES: { role: string; keywords: string[] }[] = [
  { role: '前端开发工程师', keywords: ['前端', 'React', 'Vue', 'CSS', 'TypeScript', '页面', 'Vite', 'Next'] },
  { role: '后端开发工程师', keywords: ['后端', 'Java', 'Go', 'Python', '服务端', 'API', 'Spring', '数据库'] },
  { role: '算法工程师', keywords: ['算法', '机器学习', '深度学习', '模型', '推荐', 'NLP'] },
  { role: '产品经理', keywords: ['产品', '需求', '迭代', '用户研究', '原型', 'PRD'] },
  { role: '销售', keywords: ['销售', '客户', '签约', '回款', '渠道', '拜访'] },
  { role: '运营', keywords: ['运营', '拉新', '留存', '转化', '活动', '社群'] },
  { role: '人力资源', keywords: ['招聘', '人力资源', '员工关系', '培训', 'HR', '薪酬'] },
  { role: '数据分析师', keywords: ['数据', '指标', '报表', 'BI', 'SQL', '建模'] },
  { role: '设计师', keywords: ['设计', 'UI', 'UX', '交互', '视觉', '原型'] },
]

const CATEGORY_RULES: { category: ClaimCategory; keywords: string[] }[] = [
  { category: 'honor', keywords: ['奖', '证书', '排名', '冠军', '金牌', '银牌', '铜牌', '荣获'] },
  {
    category: 'achievement',
    keywords: ['提升', '降低', '增长', '减少', '优化', '缩短', '提高', '下降', '节约', '增加', '%'],
  },
  { category: 'responsibility', keywords: ['负责', '主导', '参与', '承担', '牵头', '统筹', '带领', '组织'] },
  { category: 'scale', keywords: ['万', '用户量', '人数', '团队', '预算', '规模', 'DAU', 'MAU'] },
  { category: 'skill', keywords: ['熟练', '掌握', '使用', '熟悉', '精通', '运用'] },
]

const CATEGORY_TEMPLATES: Record<
  ClaimCategory,
  { gaps: string[]; question: string; points: string[]; followUps: string[] }
> = {
  achievement: {
    gaps: ['改造前的基线数据', '个人贡献与团队贡献的区分', '指标的统计口径与时间窗口'],
    question: '这个成果在改造前的基线是多少？',
    points: ['说明改造前后的量化指标', '区分个人与团队的贡献', '说明指标如何统计与验证'],
    followUps: ['这个数字是如何计算的？', '你个人贡献和团队贡献分别是什么？', '用什么指标验证这个结果？'],
  },
  responsibility: {
    gaps: ['具体负责的决策范围', '与他人职责的边界', '决策带来的影响'],
    question: '“负责”具体包括哪些决策？',
    points: ['说明具体职责范围', '说明如何发现问题', '说明决策带来的结果'],
    followUps: ['你负责的关键决策有哪些？', '如何发现原方案的问题？', '上线后用什么验证效果？'],
  },
  scale: {
    gaps: ['规模的统计方式', '规模对应的周期', '同行业可比基准'],
    question: '这个数字的统计口径是什么？',
    points: ['说明规模如何统计', '说明对应的时间周期', '提供可对比的基准'],
    followUps: ['这个规模覆盖多长时间？', '和同行业相比处于什么水平？', '规模背后的关键驱动是什么？'],
  },
  skill: {
    gaps: ['使用深度与场景', '遇到过的典型问题', '版本或生态的了解'],
    question: '你在什么场景下、用到什么程度使用它？',
    points: ['说明具体使用场景', '说明掌握的深度', '举一个遇到的典型问题'],
    followUps: ['遇到过什么典型问题？', '为什么选择它而不是替代方案？', '它的边界和局限是什么？'],
  },
  ability: {
    gaps: ['能力的具体表现', '可复述的案例', '能力的边界'],
    question: '能举一个体现这种能力的具体例子吗？',
    points: ['用一个具体案例说明', '说明你在其中的角色', '说明结果与复盘'],
    followUps: ['过程中最大的困难是什么？', '你怎么衡量这次协作的效果？', '如果重来会怎么调整？'],
  },
  honor: {
    gaps: ['奖项的级别与含金量', '个人在其中的贡献', '获得的时间'],
    question: '这个奖项的级别和你个人的贡献是什么？',
    points: ['说明奖项级别与规模', '说明个人贡献', '说明获得时间'],
    followUps: ['这个奖项的评选标准是什么？', '你在获奖项目中承担什么角色？', '它对后续工作有什么影响？'],
  },
}

function detectRole(text: string): string {
  for (const rule of ROLE_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) return rule.role
  }
  return '通用岗位'
}

function detectCategory(sentence: string): ClaimCategory {
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((k) => sentence.includes(k))) return rule.category
  }
  return 'ability'
}

function splitSentences(text: string): string[] {
  return text
    .split(/[。；;\n\r\t]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6)
}

function detectCandidate(text: string): string {
  const firstLine = text.split(/\n/).map((s) => s.trim()).find((s) => s.length > 0)
  if (!firstLine) return '候选人'
  // 简历首行常为姓名，过长的更可能是标题/联系方式，保守截断
  return firstLine.length <= 12 ? firstLine : firstLine.slice(0, 12)
}

function hasNumber(s: string): boolean {
  return /\d/.test(s)
}

function verifiabilityFor(category: ClaimCategory, numbered: boolean, index: number): number {
  const jitter = (index * 7) % 10
  const base: Record<ClaimCategory, number> = {
    achievement: numbered ? 86 : 74,
    scale: numbered ? 82 : 66,
    responsibility: 68,
    skill: 60,
    ability: 48,
    honor: 32,
  }
  return Math.min(96, base[category] + jitter)
}

export function mockAnalyze(rawText: string, sourceFile: string): ResumeAnalysis {
  const role = detectRole(rawText)
  const candidate = detectCandidate(rawText)
  const sentences = splitSentences(rawText)

  // 偏好含数字或关键词的句子作为声明
  const claimSentences = sentences
    .filter((s) => hasNumber(s) || CATEGORY_RULES.some((r) => r.keywords.some((k) => s.includes(k))))
    .slice(0, 6)
  const pool = claimSentences.length > 0 ? claimSentences : sentences.slice(0, 3)

  const claims: ResumeClaim[] = pool.map((quote, index) => {
    const category = detectCategory(quote)
    const tpl = CATEGORY_TEMPLATES[category]
    return {
      quote,
      title: quote.length > 14 ? `${quote.slice(0, 14)}…` : quote,
      category,
      role,
      verifiability: verifiabilityFor(category, hasNumber(quote), index),
      evidence: ['简历中提及该表述'],
      evidenceGaps: tpl.gaps,
      initialQuestion: tpl.question,
      evaluationPoints: tpl.points,
    }
  })

  const fallback: ResumeClaim[] =
    claims.length > 0
      ? claims
      : [
          {
            quote: rawText.slice(0, 40) || '未识别到有效简历内容',
            title: '示例声明',
            category: 'ability',
            role,
            verifiability: 50,
            evidence: [],
            evidenceGaps: ['简历文本过短或格式无法识别'],
            initialQuestion: '能详细说说这段经历吗？',
            evaluationPoints: ['说明背景与目标', '说明你的具体角色', '说明结果'],
          },
        ]

  const analysis: ResumeAnalysis = {
    candidate,
    role,
    sourceFile,
    rawText,
    summary: `识别到 ${fallback.length} 条可验证声明，岗位倾向「${role}」。未配置模型，以下为规则示例分析。`,
    claims: fallback,
  }

  return resumeAnalysisSchema.parse(analysis)
}

// 无模型时的面试回落：按声明类型的多轮模板推进，对过短 / 否定回答做轻度澄清。
// 不具备真正的语义分支，仅保证流程可演示。
export function mockNextQuestion(
  claim: ResumeClaim,
  turns: InterviewTurn[],
): NextQuestion {
  const tpl = CATEGORY_TEMPLATES[claim.category]
  const lastAnswer = turns[turns.length - 1]?.answer ?? ''
  const vague = lastAnswer.trim().length < 12 || /不知道|不清楚|没用过|没参与/.test(lastAnswer)

  const followIndex = turns.length - 1 // 已回答轮数对应第几条 followUp
  const covered = claim.evaluationPoints.slice(0, Math.min(turns.length, claim.evaluationPoints.length))
  const missing = claim.evaluationPoints.filter((p) => !covered.includes(p))

  if (vague && followIndex < tpl.followUps.length) {
    return nextQuestionSchema.parse({
      question: '能再具体一些吗？最好结合一个实际例子或数据。',
      intent: '引导候选人补充可验证的细节，而非泛泛而谈。',
      isFinal: false,
      coveredPoints: covered,
      missingPoints: missing,
    })
  }

  if (followIndex < tpl.followUps.length) {
    return nextQuestionSchema.parse({
      question: tpl.followUps[followIndex],
      intent: `沿「${claim.title}」继续深挖，验证声明是否经得起追问。`,
      isFinal: false,
      coveredPoints: covered,
      missingPoints: missing,
    })
  }

  return nextQuestionSchema.parse({
    question: '本轮追问到此结束。',
    intent: '已覆盖主要可验证维度。',
    isFinal: true,
    coveredPoints: covered,
    missingPoints: missing,
  })
}
