# Plinth

内置 Agent 的通用建筑设计平台。总体设计和路线图见 [#1](https://github.com/x0finch/Plinth/issues/1)，需求通过 GitHub issue 追踪。

## 已完成：阶段 1（[#2](https://github.com/x0finch/Plinth/issues/2)，数据规范 v1 + 核心包）

- `packages/core`：纯 TypeScript 核心包，不依赖浏览器
  - `schema.ts`：项目数据规范 v1（类型即文档）
  - `migrate.ts`：按版本号逐步升级旧数据；改规范时在这里加一个迁移函数
  - `geometry.ts` / `area.ts`：多边形运算、使用面积、建筑面积
  - `validate.ts`：结构校验（ID 唯一、引用存在、几何有效）
  - `legacy/fromLegacy.ts`：旧页面数据 → 规范格式（只在导入时用）
- `samples/wushi-10`：乌石合院方案十
  - `legacy.json`：从旧页面原样抓出的数据（不丢信息，规范改了可重新转换）
  - `expected-areas.json`：旧页面算出的面积，作为验收基准
  - `project.json`：规范格式的样例
- `legacy/wushi-courtyard.html`：旧页面存档

## 命令

```sh
npm install
npm run extract -- 10   # 跑旧页面，抓原始数据和面积（需要 Chromium）
npm run convert -- 10   # legacy.json → project.json，并校验
npm test                # 面积与旧页面逐间对照、转换可重跑
npm run typecheck
```

## 规范怎么演进

规范只收已经在真实方案里用到、含义确定的字段；拿不准的放进 `extras` 原样保留，
用到第二次再升格。改字段就升 `version`、在 `migrate.ts` 加一步迁移，旧样例自动升级。
