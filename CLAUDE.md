# Plinth 开发约定

总体设计与需求：GitHub issue #1（epic）及其子 issue。改动前先看对应阶段的 issue。

## 界面
- 只用 shadcn/ui 组件（Base UI 底层、Nova 风格）：列表用 `Item`，表格用 `Table`，提示用 `Alert`，卡片用 `Card`，链接样式用 `Button variant="link"`。不要手写 `<button>`、`<table>` 或带边框的 `<div>` 当卡片。
- 主题是 shadcn 的 Vercel 主题。网页（`apps/web/src/styles.css`）跟随系统深浅色。
- 画布（平面图、三维）在同源 iframe 里渲染（`apps/web/src/canvas/CanvasFrame.tsx`），样式独立（`canvas/canvas.css`），只有亮色，不受网页主题影响。亮色变量在 `apps/web/src/theme/light.css`，网页和画布共用。
- 颜色只引用主题变量：`var(--background)`、`text-muted-foreground`、`var(--chart-2)` 等。不写十六进制、`rgb()`/`oklch()`，不用 Tailwind 色板（amber、blue…）。three.js 需要具体颜色时用 `apps/web/src/lib/theme.ts` 从主题变量读取（画布里传 `useCanvasDocument()`）。
- 提交前跑 `npm run check:theme -w @plinth/web`。

## 数据与能力
- 所有修改走能力清单（`packages/core/src/builtins.ts`），在事务里执行；界面、agent、`window.artifact.call` 共用。
- 规范字段拿不准时放进 `extras`；改规范要升 `version` 并在 `migrate.ts` 加迁移。

## 验证
- `npm test`（核心包契约测试）、`npm run typecheck`、`npx tsc --noEmit -p apps/web`
- 端到端：见 README 的“测试”。
