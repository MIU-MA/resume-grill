# Resume Grill

> 面向简历陈述的可信度压力测试工具。

Resume Grill 从简历中提取可验证陈述，围绕具体陈述连续追问，并根据回答中的证据、职责边界和结果口径生成复盘报告。它不是八股题库，也不是完整的求职管理平台；核心目标是回答一个更具体的问题：**写进简历的这句话，能否经得住面试追问？**

## 功能

- 上传 PDF 或粘贴文本，并在分析前校对浏览器提取的正文
- 识别技能、职责、成果、管理和数据五类可验证陈述
- 先识别个人概况、工作、实习、项目、教育、技能等章节，再从经历正文提取陈述
- 分别标注可信风险、面试风险、现有证据与证据缺口
- 针对单条陈述进行 3–5 轮动态追问
- 跟踪已覆盖和仍缺失的评估要点
- 生成单次压力测试结论、改写建议和 Markdown 汇总报告
- 使用 IndexedDB 建立本地简历列表，按正文去重，刷新或再次访问时可继续分析与会话
- 支持 OpenAI 兼容的模型接口和浏览器本地模型设置

未配置模型时，应用只提供基于规则的**简历分析预览**。动态追问、复盘和改写建议需要可用的模型配置。

## 快速开始

环境要求：Node.js 20.9 或更高版本。

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

常用检查命令：

```bash
npm run lint
npm test
npm run build
```

## 模型配置

项目调用 OpenAI Chat Completions 兼容接口，并要求模型返回 JSON 对象。可以选择以下任一方式。

### 服务端配置

复制 `.env.example` 为 `.env.local`：

```bash
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

服务端配置适合部署场景。API Key 只由 Route Handler 读取，不会下发到浏览器。

### 浏览器配置

也可以在页面右上角的模型设置中填写 `Base URL`、`API Key` 和 `Model`，然后点击“保存”。这些信息保存在当前浏览器的 `localStorage` 中，并随同源请求发送给 Next.js Route Handler，再由服务端转发给模型服务。

此模式适合个人本地使用。公开或多人部署时，应使用服务端环境变量，避免让用户在不受信任的站点中保存密钥。

自建模型或 Ollama 通常使用本机或内网地址。服务端默认会阻止这类地址以防止 SSRF，需要由部署者显式加入白名单：

```bash
ALLOWED_LLM_BASE_URLS=http://127.0.0.1:11434
```

多个 origin 使用逗号分隔。

## 工作流程

```text
PDF / 文本
  -> 浏览器提取并校对正文
  -> 本地识别章节、条目标题和可追问正文
  -> /api/analyze 生成结构化简历分析
  -> 选择一条简历陈述
  -> /api/analyze-claim 生成验证目标与常见陷阱
  -> /api/interview/start 生成第一问
  -> /api/interview/continue 评估回答并动态追问
  -> /api/summarize 生成结论与改写建议
  -> IndexedDB 保存记录 / 导出 Markdown 报告
```

模型输出均经过 Zod 校验。面试覆盖点还会在服务端与原始评估要点取交集，缺失项由服务端重新计算，避免模型新增不存在的验证点或产生超过 100% 的覆盖率。

## 项目结构

```text
app/
  api/
    analyze/             简历文本分析
    analyze-claim/       单条陈述验证目标分析
    interview/start/     开始压力测试
    interview/continue/  回答评估与下一问
    summarize/           会话总结与改写建议
    status/              服务端模型配置状态
src/
  components/            上传、审计、面试、报告与模型设置界面
  domain/                Resume / Interview Zod 数据契约
  lib/                   提示词、PDF、持久化、报告、限流与覆盖率校验
  providers/             OpenAI 兼容接口与无模型规则分析
  App.tsx                页面状态和业务流程编排
```

## 数据与隐私

- PDF 文件由 PDF.js 在浏览器中提取，文件本身不会上传到应用服务器。
- 确认后的简历文本会发送到同源 `/api` 路由；启用模型后，相关文本和回答会继续发送给所配置的模型供应商。
- 简历分析、原始文本和面试会话保存在当前浏览器的 IndexedDB 中，用于刷新恢复。
- 浏览器模式下的模型配置保存在 `localStorage` 中；清除站点数据或点击设置中的“清除已保存”可移除配置。
- 项目不会主动创建云端用户档案，但模型供应商可能按其自身政策记录请求。处理真实简历前请确认供应商的数据政策。

## 安全边界

- API 请求包含文本长度、回答长度、轮数和超时限制
- 内置按 IP 的进程内限流，适合本地或单实例演示
- 自定义模型地址经过协议、DNS 和内网地址检查
- 结构化模型输出经过 Zod schema 校验

进程内限流不适合多实例生产环境。公开部署前应接入共享限流存储、身份认证和独立的密钥管理方案。

## 技术栈

- Next.js 16（App Router）
- React 19 + TypeScript
- Tailwind CSS 4
- Zod 4
- PDF.js
- IndexedDB（idb-keyval）
- Vitest
- Oxlint

## 当前范围

Resume Grill 专注于简历陈述的证据审计和压力测试。当前不计划扩展为 JD 匹配、投递管理、Offer 跟踪或完整简历编辑器，以保持项目边界清晰并降低个人维护成本。
