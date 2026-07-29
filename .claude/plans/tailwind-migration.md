# CSS -> Tailwind v4 迁移方案

确认：Tailwind v4 + 抽 `<Button>` 组件 + `cn` 工具 + 像素级还原（任意值）。删除 App.css，globals.css 改为 @theme + 重置。

## 基建
1. 装 `tailwindcss`（v4）、`clsx`、`tailwind-merge`。
2. `app/globals.css`：`@import "tailwindcss";` + `@theme` 把设计 token 映射为 Tailwind 颜色/断点：
   - 颜色（避开 Tailwind 默认 blue/red/green 名）：`--color-ink/ --color-muted/ --color-faint/ --color-line/ --color-line-strong/ --color-surface/ --color-canvas/ --color-brand(--blue)/ --color-brand-soft/ --color-red/ --color-red-soft/ --color-amber/ --color-amber-soft/ --color-green/ --color-green-soft` -> 可用 `bg-surface text-muted border-line` 等。
   - 自定义断点：`--breakpoint-md1: 620px; --breakpoint-md2: 860px; --breakpoint-md3: 1100px;`（min-first）。响应式从 max-N 改为 min-first：移动端样式作为基础，`md1:`/`md2:`/`md3:` 叠加桌面。**注意原 CSS 是 max-width（桌面优先），迁移时需反转逻辑**。
3. `src/lib/cn.ts`：`export const cn = (...a) => twMerge(clsx(a))`。
4. `src/components/Button.tsx`：变体 `primary | secondary` + `large | icon` + `className` 透传。封装 `.button/.icon-button` 全部样式。
5. `next.config.ts`：v4 无需 PostCSS 配置文件（内置），但需确认 `@import "tailwindcss"` 在 globals.css 生效。无需 tailwind.config。

## 组件迁移（12 个 + App）
每个组件 className 改为工具类，非标准值用任意值 `[]`。逐个映射 App.css 规则。重点：
- **伪元素圆点**（evidence-section p::before）：`before:absolute before:left-0 before:top-[5px] before:size-1 before:rounded-full before:bg-[#8ea09a]`，gaps 变体用 `before:bg-amber`。
- **divider 线**（::before/::after）：用 `before:flex-1 before:h-px before:bg-line after:flex-1 after:h-px after:bg-line`。
- **动画**：spin 用 `animate-spin`（Tailwind 内置）；scan 自定义 -> `@theme` 加 `--animate-scan` 或 globals.css 留一个 `@keyframes` + `animate-[scan_1.3s_ease-in-out_infinite_alternate]`。SessionReport 不用 spin。
- **grid 模板列**（非标准）：`grid-cols-[264px_minmax(240px,1fr)_auto]` 等。
- **字号**：`text-[9px]` 等。
- **meter 进度条**：内层 `<i>` 用 `block h-full rounded-[inherit] bg-brand`（evidence 用 `bg-green`），宽度 `style={{ width: \`${n}%\` }}`。
- **risk-dot**：抽小组件或工具类串 `size-1.5 rounded-full bg-red shadow-[0_0_0_3px_var(--color-red-soft)]`。box-shadow 任意值用 CSS 变量。
- **transition/任意值阴影**：直接工具类或任意值。

## 响应式逻辑反转（关键）
原 max-width 桌面优先 -> Tailwind min-first：
- `≤620`：基础（mobile）
- `>620`（md1）：`.claim-list` 从横向滚动恢复纵向、`.topbar` static 取消等
- `>860`（md2）：显示 insight-panel、topbar-context、workspace 三栏
- `>1100`（md3）：栏宽调整
逐条核对原 3 个 media query 的每条规则，反转到对应 min 断点。

## 验收
- `npm run build` 通过（Tailwind v4 + Turbopack）。
- 视觉与迁移前一致（重点：三栏布局、字号、断点行为、risk 配色、按钮）。
- `npm test`/`lint` 不回归。
- App.css 删除，无残留旧类引用。

## 不改
- 业务逻辑、组件结构、props 全部不动，只换样式实现。
- globals.css 保留：重置、::selection、focus-visible、@theme、scan keyframes。
