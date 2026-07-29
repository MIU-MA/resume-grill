import { z } from 'zod'

// 简历声明的六种类型：覆盖技术岗之外的通用简历语言
export const claimCategorySchema = z.enum([
  'skill', // 技能声明：熟练使用某工具或技术
  'responsibility', // 职责声明：负责、主导、参与某项工作
  'achievement', // 成果声明：提升转化率、降低成本、缩短周期
  'scale', // 规模声明：管理人数、用户量、预算、项目规模
  'ability', // 能力声明：沟通、管理、分析、跨部门协作
  'honor', // 荣誉声明：奖项、证书、排名
])
export type ClaimCategory = z.infer<typeof claimCategorySchema>

export const CLAIM_CATEGORY_LABELS: Record<ClaimCategory, string> = {
  skill: '技能声明',
  responsibility: '职责声明',
  achievement: '成果声明',
  scale: '规模声明',
  ability: '能力声明',
  honor: '荣誉声明',
}

// 单条可验证的简历声明
export const resumeClaimSchema = z.object({
  // 简历原文片段
  quote: z.string(),
  // 短标题，用于列表与卡片展示
  title: z.string(),
  // 声明类型
  category: claimCategorySchema,
  // 对应岗位 / 职能
  role: z.string(),
  // 被追问概率 0-100：越高越可能在面试中被深挖（含数字的成果/规模声明通常偏高）
  askLikelihood: z.number().min(0).max(100),
  // 证据完整度 0-100：越高表示简历中已提供的证据越充分、越稳固
  evidenceStrength: z.number().min(0).max(100),
  // 简历中已经提供的证据
  evidence: z.array(z.string()),
  // 证据缺口：容易被追问的地方
  evidenceGaps: z.array(z.string()),
  // 首轮追问
  initialQuestion: z.string(),
  // 评估应覆盖的要点（用作自检清单，不参与假分数）
  evaluationPoints: z.array(z.string()),
})
export type ResumeClaim = z.infer<typeof resumeClaimSchema>

// 一次简历分析的完整结构
export const resumeAnalysisSchema = z.object({
  candidate: z.string(),
  role: z.string(),
  sourceFile: z.string(),
  rawText: z.string(),
  summary: z.string(),
  claims: z.array(resumeClaimSchema).min(1),
})
export type ResumeAnalysis = z.infer<typeof resumeAnalysisSchema>

// LLM 输出子集：不含 rawText / sourceFile（由服务端从输入回填，避免回传大段文本浪费 token）
export const llmAnalysisSchema = z.object({
  candidate: z.string(),
  role: z.string(),
  summary: z.string(),
  claims: z.array(resumeClaimSchema).min(1),
})
export type LlmAnalysis = z.infer<typeof llmAnalysisSchema>
