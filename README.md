<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/favicon.svg">
    <img src="public/favicon.svg" width="96" height="96" alt="Resume Grill">
  </picture>
</p>

<h1 align="center">Resume Grill</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.2-black?logo=next.js" alt="Next.js 16.2">
  <img src="https://img.shields.io/badge/React-19.2-087ea4?logo=react" alt="React 19.2">
  <img src="https://img.shields.io/badge/Tailwind-4.3-38bdf8?logo=tailwindcss" alt="Tailwind 4.3">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
</p>

---

Resume Grill 将简历中的项目、技能和成果转化为能力测试，通过连续追问检查实际场景、实现过程、技术原理、方案取舍和能力边界，并根据回答生成待补强知识点和简历表达建议。

> 当前版本面向个人在本机运行，暂未提供线上部署方案。

## 功能概览

| 环节 | 说明 |
|------|------|
|  简历导入 | 支持 PDF、DOCX、TXT、Markdown 和直接粘贴文本 |
|  本地解析 | PDF、DOCX 在浏览器端解析（PDF.js / mammoth），无需上传原始文件 |
|  提取校对 | 识别个人信息、教育、工作、实习、项目、技能、奖项等章节，支持人工修正 |
|  陈述管理 | 从职责、技能、成果、数据等维度生成能力声明，支持删改、合并与优先级设定 |
|  岗位匹配 | 可选填岗位描述，检查 JD 要求是否有对应简历证据 |
|  能力测试 | 每条声明进行多轮追问，基于掌握要点（背景、实践、原理、决策、排查、边界）逐项验证 |
|  不懂批注 | 标记术语请求通俗解释，澄清轮次不计入追问与覆盖统计 |
|  测试报告 | 汇总掌握度、已讲清内容、尚未讲清的要点和待补强知识点 |
|  盲区管理 | 标记知识点为已掌握，基于原声明创建新测试版本 |
|  导出 | 支持导出 Markdown 格式报告 |

未配置模型时，应用仍可提供基于规则的简历分析预览。连续追问、回答判断和复盘需要一个可用的 OpenAI Chat Completions 兼容接口。

## 界面预览

<table>
  <tr>
    <td align="center"><strong>简历确认</strong><br/>检查解析结果，选择保留的陈述</td>
    <td align="center"><strong>能力清单</strong><br/>查看核心能力、掌握要点和测试优先级</td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/resume-review.png" width="100%" alt="简历确认页"></td>
    <td><img src="docs/screenshots/audit.png" width="100%" alt="能力清单页"></td>
  </tr>
  <tr>
    <td align="center"><strong>能力测试</strong><br/>通过连续追问验证每项掌握要点</td>
    <td align="center"><strong>测试报告</strong><br/>掌握度、尚未讲清内容与待补强知识点</td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/interview.png" width="100%" alt="能力测试页"></td>
    <td><img src="docs/screenshots/report.png" width="100%" alt="测试报告页"></td>
  </tr>
</table>

## 快速开始

**前置要求：** Node.js ≥ 20.9

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。

```bash
# 提交前检查
npm run lint
npm test
npm run build
```

仓库附带示例材料，可体验完整流程：

- [示例简历](examples/sample-resume.txt)
- [示例岗位描述](examples/sample-job-description.txt)
- [材料说明](examples/README.md)

## 模型配置

项目使用 OpenAI Chat Completions 兼容接口，提供两种本地配置方式。

### 环境变量（推荐）

复制 `.env.example` 为 `.env.local`：

```bash
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-…
OPENAI_MODEL=gpt-4o-mini
```

API Key 仅由本机 Next.js Route Handler 读取，不会发送到前端。

### 浏览器设置

点击页面右上角模型设置图标，填写 `Base URL`、`API Key` 和 `Model`。配置保存在 `localStorage` 中，请求经同源 API 转发至模型服务商。

> 浏览器配置适合个人本机使用，不适合部署到不受信任的公开站点。

### 自建模型 / Ollama

Ollama 等本地模型通常使用本机或局域网地址。项目默认拦截此类地址以降低 SSRF 风险，确需访问时可在服务端配置白名单：

```bash
ALLOWED_LLM_BASE_URLS=http://127.0.0.1:11434
```

多个地址用逗号分隔。

## 数据流与隐私

| 阶段 | 数据去向 |
|------|----------|
| PDF 解析 | 浏览器本地（PDF.js），原始文件不上传 |
| 简历文本 | 提交至同源 API |
| 模型调用 | 简历文本、岗位描述、面试回答发送至所选模型服务商 |
| 面试记录 | 浏览器 IndexedDB |
| 模型配置 | 浏览器 `localStorage` |

---

<p align="center">
  <a href="./LICENSE">MIT License</a> · <a href="https://github.com/MIU-MA/resume-grill/issues">提交反馈</a>
</p>
