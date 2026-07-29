# 简历拷打机

> 不是根据岗位随机生成八股，而是验证你简历里的每一句声明是否经得起追问。

从简历中提取「可验证声明」，沿着你的回答动态追问，并标注证据缺口。它不是八股题库——每一组问题都绑定一条简历原文。

## 能力

- 上传 PDF / 粘贴文本，浏览器本地提取简历内容（简历不会上传永久存储）
- 识别候选人、岗位，并把简历拆成可验证声明（技能 / 职责 / 成果 / 规模 / 能力 / 荣誉）
- 每条声明带可验证难度、证据缺口、首轮追问与评估要点
- 模拟面试：根据你的回答动态生成下一问，而非读取预设题库
- 标注已覆盖 / 仍缺失的评估要点，导出 Markdown 风险报告
- 未配置模型时，使用内置规则示例分析，无需 Key 即可演示完整流程

## 本地运行

```bash
npm install
npm run dev      # http://localhost:3000
```

生产构建：

```bash
npm run lint
npm run build
npm test         # 纯函数单元测试
```

## 接入真实模型（可选）

复制 `.env.example` 为 `.env.local` 并填入：

```bash
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

支持任何 OpenAI 兼容接口（OpenAI、DeepSeek、Moonshot、本地 Ollama 的 OpenAI 兼容端点等）。
**API Key 只在服务端 Route Handler 中读取，绝不下发到浏览器。**
三个变量任一缺失，自动回落到规则示例分析。

## 架构

```
Next.js App Router
├─ app/
│  ├─ layout.tsx               根布局
│  ├─ page.tsx                 入口（渲染 App）
│  └─ api/
│     ├─ analyze/route.ts      简历文本 → 结构化 ResumeAnalysis
│     └─ interview/route.ts    根据回答动态生成下一问
├─ src/
│  ├─ domain/                  Zod schema（resume / interview）
│  ├─ providers/
│  │  ├─ openai-compatible.ts  服务端 LLM 调用
│  │  └─ mock.ts               无 Key 时的输入感知示例分析
│  ├─ lib/                     pdf 提取 / 报告 / 风险映射 / 提示词
│  ├─ components/              Topbar / Sidebar / Audit / Interview / Insight / Uploader
│  └─ App.tsx                  状态编排
```

数据流：

```
上传 / 粘贴简历
  → PDF.js 提取文本（浏览器本地）
  → /api/analyze
  → LLM（或 mock）输出经 Zod 校验的 ResumeAnalysis
  → 选择一条声明开始拷打
  → /api/interview 根据上一轮回答动态追问
  → 形成命中 / 缺失要点
  → 导出报告
```

核心数据结构（`src/domain/resume-schema.ts`）：

```ts
type ResumeClaim = {
  quote: string                                  // 简历原文
  category: 'skill' | 'responsibility' | 'achievement' | 'scale' | 'ability' | 'honor'
  role: string
  verifiability: number                          // 可验证难度 0-100，越高越难自证
  evidence: string[]
  evidenceGaps: string[]
  initialQuestion: string
  evaluationPoints: string[]
}
```

## 隐私

- PDF / 文本在浏览器本地解析，简历内容不持久存储
- 接入模型时，简历文本仅经服务端 Route Handler 转发到模型；默认不上传永久存储

## 当前进度

已实现：真实简历解析闭环、通用声明提取、单声明动态追问、证据缺口标注、报告导出、单元测试。

待完善（后续迭代）：可信数值评分（多信号，替代启发式）、跨会话面试汇总与简历修改建议、移动端证据抽屉、`analysis/[id]` 路由拆分、IndexedDB 持久化、Ollama provider。

## 技术栈

- Next.js 16（App Router + Turbopack）
- React 19 + TypeScript
- Zod（结构化输出校验）
- PDF.js（浏览器内 PDF 提取）
- Lucide React
- Vitest
