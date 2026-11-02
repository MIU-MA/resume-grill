# 业务模块

每个目录对应一个用户可识别的业务。视图、组件和该模块专用逻辑放在一起。

| 模块 | 职责 |
| --- | --- |
| `applications` | 职位、邮件、官网填写与投递记录的工作台入口，内部按任务分组 |
| `job-assistant` | AI 找岗位的界面、计划、读取与匹配任务、进度存储 |
| `audit` | 简历要点的练习清单与详情 |
| `interview` | 模拟面试、会话状态与面试提示词 |
| `knowledge` | 复习笔记与知识点界面 |
| `report` | 面试报告、改写比较与报告导出 |
| `resume` | 简历导入、确认、诊断、文档版本与岗位准备 |
| `settings` | 统一设置入口、模型与邮箱配置、本机及扩展连接诊断 |
| `workspace` | 工作台导航、侧栏与页面布局 |

组件使用 `PascalCase.tsx`，业务 Hook 放在 `hooks/use-*.ts`，业务逻辑放在 `lib/*.ts`。模块内已有职责明确的独立文件可以保留，不需要为了层级统一再套目录。测试与被测文件放在一起。

## 投递模块

| 目录 | 职责 |
| --- | --- |
| `applications/jobs/` | 职位清单、官网链接与正文导入、岗位详情、岗位版简历 |
| `applications/mail/` | 邮件草稿、收件名单、模板、附件与发送预览 |
| `applications/website/` | 官网填写、扩展通信、可复用资料与经历 |
| `applications/history/` | 合并投递记录、手动登记、进展与投递快照 |
| `applications/hooks/` | 跨任务的工作台协调，以及本机执行器连接 |

各任务的组件直接放在所属目录，Hook 放在各自的 `hooks/`，解析、存储和规则放在各自的 `lib/`。根目录保留 `MailWorkbench`、工作台标题、跨任务添加入口及集成测试。跨组引用明确到文件，不增加统一导出或重复实现。

独立简历检查由 `resume/ResumeCheckWorkspace.tsx` 管理文档，复习内容操作由 `knowledge/hooks/use-knowledge-actions.ts` 管理；应用层负责衔接它们与面试流程。

跨模块纯规则和共享数据契约放在 `src/domain/`；跨模块流程由 `src/application/` 编排。`src/hooks/` 和 `src/lib/` 分别保留通用交互与共享基础设施，不能作为业务代码的默认存放处。

跨模块直接导入需要的文件，不添加汇总导出，不引入运行时循环依赖。浏览器侧通过协议连接邮件执行器，不导入 `src/mail-agent/` 实现。

完整约定见仓库根目录的 [AGENTS.md](../../AGENTS.md)，依赖边界通过 `npm run check:architecture` 检查。
