# 参与开发

欢迎提交可复现的 Bug、官网适配证据和小范围改进。目录、命名与依赖规则见 [AGENTS.md](AGENTS.md)。

## 本地准备

使用 Node.js 24，运行 `npm ci`。只调试网页运行 `npm run dev`；需要本机执行器时运行 `npm run dev:local`，不要与前者同时启动。退出时按 Ctrl+C。

用 [examples](examples/README.md) 中的材料测试。不要提交真实简历、联系方式、API Key、邮箱授权码、连接码或 `.mail-agent/`。漏洞请按 [SECURITY.md](SECURITY.md) 私下报告。

## 提交改动

1. 说明实际问题、复现方法与修改后的行为。较大功能先开 Issue 对齐范围。
2. 业务代码放入对应模块；涉及状态、存储、异步恢复或表单适配时补回归测试。
3. 执行以下检查，说明不能完成的验证与原因：

```bash
npm run check:architecture
npm run lint
npm test
npm run build
npx tsc --noEmit
```

4. PR 描述写明修改内容、验证结果和已知限制。UI 改动附使用示例数据的截图；不把自动生成的构建文件加入 Git。

## 官网适配

记录网址、日期、浏览器、是否登录以及逐项填写结果。区分“公开源码推断”“本地 HTML 回归”和“登录后实测”；仅有目录入口不能标记为已适配。测试资料必须脱敏，Cookie、请求头和个人附件不入库。不要绕过验证码或自动最终提交申请。

## 发布

发布前检查见 [docs/releasing.md](docs/releasing.md)。推送 `v*` 标签会触发安装包发布与镜像构建，只有维护者确认后才执行。
