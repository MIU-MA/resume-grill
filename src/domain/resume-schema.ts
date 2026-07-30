import { z } from 'zod'

// 简历声明的五种类型：通用简历语言，不偏向技术岗
export const claimCategorySchema = z.enum([
  'skill', // 技能声明：熟练使用某工具或技术
  'responsibility', // 责任声明：负责、主导、参与某项工作
  'achievement', // 成果声明：提升转化率、降低成本、缩短周期
  'leadership', // 管理声明：带团队、建体系、定流程、做决策
  'metric', // 数据声明：人数、金额、规模、增长率等带量纲的表述
])
export type ClaimCategory = z.infer<typeof claimCategorySchema>

export const CLAIM_CATEGORY_LABELS: Record<ClaimCategory, string> = {
  skill: '技能声明',
  responsibility: '责任声明',
  achievement: '成果声明',
  leadership: '管理声明',
  metric: '数据声明',
}

// 风险三档：高 / 中 / 低。不给分数，给定性风险。
export const riskLevelSchema = z.enum(['high', 'medium', 'low'])
export type RiskLevel = z.infer<typeof riskLevelSchema>

// 单条可验证的简历声明
export const resumeClaimSchema = z.object({
  // 简历原文片段（声明内容）
  content: z.string(),
  // 短标题，用于列表与卡片展示
  title: z.string(),
  // 声明类型
  category: claimCategorySchema,
  // 对应岗位 / 职能
  role: z.string(),
  // 该声明出自简历哪一段（如 "工作经历" / "项目经验"），用于分析页分组展示
  sourceSection: z.string(),
  // 可信风险：该声明被夸大或无法自证的程度
  exaggerationRisk: riskLevelSchema,
  // 面试风险：该声明在面试中被深挖后暴露问题的程度
  interviewRisk: riskLevelSchema,
  // 证据缺失：声明里缺了什么可被追问的要素
  evidenceGap: z.array(z.string()),
  // 简历中已经提供的证据
  evidence: z.array(z.string()),
  // 首轮追问
  initialQuestion: z.string(),
  // 评估应覆盖的要点（用作自检清单）
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
