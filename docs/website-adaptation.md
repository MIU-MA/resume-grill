# 官网适配记录

核对日期：2026-10-23。这里只记录实际访问和验证范围，目录中的公司不自动视为支持。

## Lever：首个公开申请页样本

- 岗位：Pigment / Senior Frontend Engineer (UK)
- 来源：https://jobs.lever.co/pigment/cb04a184-0756-461c-b4b3-58f779a82b09/apply
- 上传行为参考：https://jobs.lever.co/js/parseResume.js
- 实际通过 HTTPS GET 取得申请页（200）和公开上传脚本。未填写外站个人资料、未上传附件、未提交申请。
- `data/website-forms/lever-pigment.html` 是裁剪后的真实表单结构，保留字段和必选问题，删除脚本、SVG 和无关内容。不是人工编造的通用表单；也不包含账号、候选人资料、访问令牌。

### 已实现

- 只在 jobs.lever.co / jobs.eu.lever.co 且存在 `form#application-form` 时启用（EU 域名仅识别，尚无 EU 样本验证）。
- 从 `.application-question .application-label` 识别外置标签，填写姓名、邮箱、电话、当前公司。
- 原生控件沿用事件和写入后检查，保留已填写的内容。
- 根据 `.required-field` / `.required` 识别必答选择题；按题组检查，不要求把全部选项都勾选。
- 城市输入同时依赖 `selectedLocation`，不把纯文字当作选中城市；提示在官网搜索选择。
- 附件只有取得页面已有 `resumeStorageId` 才报告确认。刚设置 FileList 或异步解析尚未完成时保留待处理，用户核对后继续；不重复替换已有附件。
- 工作台显示填写摘要和具体未完成项。

### 验证边界

已完成公开 HTML / 脚本检查和本地 DOM 回归。尚未在安装扩展的真实浏览器中验证受控事件、城市搜索、文件网络上传或最终提交，不能标为“实站全流程通过”。异步上传失败和延迟由待处理状态兜底。此样本中未出现教育、工作经历多段表单，不能外推覆盖能力。

## 其他访问结果

- 字节招聘首页在浏览器成功打开；随后岗位列表交互超时，尚未取得申请表 DOM，不添加臆测的字段选择器。
- PingCAP 官网可读取，但旧 Lever 招聘入口当前返回 404，不使用旧索引作为可用适配证据。
- Websoft9、优码云、蓝曜炬辉公开招聘页的服务端 HTML 未发现简历申请表（Websoft9 只有站点搜索输入）。这不证明动态页面不存在申请表，也不标为支持。

## 下一轮优先项

1. 在用户已登录的国内官网申请页收集去身份化字段结构，优先适配用户实际投递的网站。
2. 为每个适配器增加浏览器端验证记录：填写值是否保留、选项是否选中、上传是否被服务端确认、步骤能否恢复。用测试账号或授权的测试申请验证上传，不向真实招聘方发送虚构申请。
3. 把字段结果区分为已填写、需选择、上传处理中、上传失败，支持只重试未完成部分。
4. 将多段教育 / 项目 / 工作经历从简历结构化一次后复用；新增控件必须按具体站点适配，不能把第一段经历复制进所有行。
5. 在工作台按申请任务绑定简历版本、缺项和下一步操作，减少反复切换页面找失败原因。

## 国内官网检查：2026-10-24

检查了下列 10 家的公开入口和部分前端资源。访问不带账号、Cookie 或个人资料，没有上传文件、保存简历或提交申请。内置浏览器的开页/读取连续超时，因此本轮 **没有登录后 DOM 或安装扩展后的实站验证**。HTTP 200 只说明入口可访问。机器可读记录见 `data/website-forms/domestic-audit.json`。

| 官网 | 本轮实际取得的证据 | 仍未验证 |
| --- | --- | --- |
| 腾讯 careers.tencent.com | 首页 200；应用脚本请求 403，未继续请求受限资源 | 申请表、填写、上传 |
| 字节 jobs.bytedance.com | 首页与公开脚本可读，有简历编辑路由；直接访问 `/resume/edit` 返回 404 | 正确动态申请路径及表单 |
| 阿里 talent.alibaba.com | 首页、门户脚本可读 | 登录后的申请表 |
| 小红书 job.xiaohongshu.com | 社招申请分块含姓名、手机号、邮箱、教育、工作/实习字段和 Vue 表单组件 | 实际挂载结构、受控事件、附件上传 |
| B站 jobs.bilibili.com | 公开渲染器含 Ant Design Vue 表单、经历栏目及编号、上传结果展示 | 登录后的渲染差异、真实上传 |
| 美团 zhaopin.meituan.com | 入口跳转 `/web/home`，资源加载器可读 | 申请表、填写、上传 |
| 京东 zhaopin.jd.com | 首页含岗位搜索控件、未登录标记 | 登录后的简历编辑表 |
| 百度 talent.baidu.com | 公开简历脚本含姓名、移动电话、邮箱；`/resume/create` 返回 `need-login` | 登录后的表单和上传 |
| 快手 zhaopin.kuaishou.cn | 动态首页、Ant Design 依赖及简历编辑路由 | 登录后表单 |
| 网易 hr.163.com | 首页与应用脚本可读 | 申请表、填写、上传 |

### 本轮代码变化与本地验证

- 共用标签识别：支持 Ant Design、Element、Semi、Fusion/Next、Arco 的外置标签和必填标记；后四类是通用组件契约，**不代表某家公司已确认采用该框架**。选择项和 placeholder 不再混入字段标签。
- 单选下拉框：仅操作具备 `role=combobox` 并通过 `aria-controls/aria-owns` 关联一个可见 listbox 的控件，精确匹配唯一、可用选项。点击后核对已选展示文本；搜索框文本不算选中。多选、多级地址、无关联弹层、远程搜索无可见结果时保留人工处理。
- 校验：派发 blur/focusout，检查原生 validity、aria-invalid 和常见框架错误状态；日期组件不再仅写入文字就算完成。保留已有内容，已有无效值会提示。
- SPA：搜索框先出现时继续等待申请资料控件，最长 4 秒；页面未准备好可在原标签页继续。
- B站经历：只在准确域名上识别公开渲染器的 `.bili-form-card-body`、`.bili-form-multiple` 和编号标签，按栏目与编号映射。空白分组可填，已有内容、不明编号和新增行交给用户。公司名称、描述、学校城市、起止时间分别识别，避免串字段。
- B站上传：识别 `.bili-resume-analysis` 内匿名文件控件；公开代码只有上传结果含 URL 时才显示 `.bili-resume-annalysis-name`，据此检查页面确认状态，更新中/解析中不算确认。其他国内站点尚无上传完成适配，FileList 不作为成功依据。

`bilibili-source-contract.html` 是根据公开渲染代码 **重建的最小结构**，不是登录后的 HTML 快照。对应测试名称明确注明“重建契约”；共用控件测试也不计作单个官网通过。

### 可追溯资源

- [B站应用代码](https://s1.hdslb.com/bfs/static/zhaopin-toc/assets/js/app.b102573e.js)：上传组件及登录路由。
- [B站组件代码](https://s1.hdslb.com/bfs/static/zhaopin-toc/assets/js/chunk-vendors.7909f1c5.js)：BiliFormCard、BiliForm、BiliControl 渲染器。
- [B站简历页代码](https://s1.hdslb.com/bfs/static/zhaopin-toc/assets/js/resume.e870c414.js)：编辑与查看页面。
- [小红书社招申请代码](https://fe-static.xhscdn.com/formula-static/ats-website/public/js/706.ab7cfa2.chunk.js)：基础信息及经历字段。
- [百度简历代码](https://talent-offical-static-prod.cdn.bcebos.com/hcm-recruitment/talent-offical-static-prod/client/static/js/resume.043c5f7c.chunk.js)：基本信息、教育与工作字段。

这些带版本的资源可能随官网更新失效。下一步应取得用户已登录且已授权访问的具体申请页，逐项验证填写值保留、下拉选中、多段经历和上传确认，再把对应官网升级为“已实测”。
