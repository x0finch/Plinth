# Plinth

内置 Agent 的通用建筑设计平台：业主说需求、做决定，agent 是方案的作者——画墙开窗、排房间、算面积、自己检查。
总体设计和路线图见 [#1](https://github.com/x0finch/Plinth/issues/1)，需求通过 GitHub issue 追踪。

## 结构

| 目录 | 内容 |
| --- | --- |
| `packages/core` | 纯 TypeScript 核心包，不依赖浏览器：数据规范、操作层（事务、撤销）、能力清单、规则检查、约束求解、面积、三维墙体分段 |
| `apps/web` | 网站：TanStack Router 单页应用 + Cloudflare Worker（Hono），D1 存储，Better Auth 登录，TanStack AI 对话 |
| `samples/wushi-10` | 测试样例：乌石合院方案十 |

关键约定：
- 所有修改（界面、agent、`window.artifact.call`）都调用同一张能力清单（`packages/core/src/builtins.ts` + `apps/web/src/agent/view-capabilities.ts`），走同一个事务和撤销。
- agent 的工具就是能力清单，在打开方案的浏览器里执行；服务端只用项目配置的密钥转发大模型请求。
- 页面由静态资源层直接返回，Worker 里只有 `/api/*`，不带 React（压缩后约 0.7 MB，适合免费版）。

## 本地开发

```sh
npm install
cd apps/web
cp .dev.vars.example .dev.vars        # 填 BETTER_AUTH_SECRET、KEY_ENCRYPTION_SECRET（openssl rand -base64 32）
npm run db:migrate:local
npm run dev                            # http://localhost:3000；验证码打印在终端
```

## 测试

```sh
npm test                               # 核心包：面积对照、能力契约、约束（根目录）
cd apps/web
npm run fake-llm &                     # 假大模型（OpenAI 兼容接口，脚本化工具调用）
npm run dev &
npm run e2e                            # 端到端：agent 对话、确认、从零起步、分享、评论、版本、手机布局
```

## 部署（Cloudflare Workers 免费版）

D1 数据库 `plinth` 已建好（ID 写在 `wrangler.jsonc`）。需要一个有 Workers 和 D1 编辑权限的 `CLOUDFLARE_API_TOKEN`：

```sh
cd apps/web
npm run db:migrate:remote
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put KEY_ENCRYPTION_SECRET
npx wrangler secret put RESEND_API_KEY          # 验证码邮件；不配则线上只能访客试用和 Google 登录
npx wrangler secret put GOOGLE_CLIENT_ID        # 可选
npx wrangler secret put GOOGLE_CLIENT_SECRET    # 可选
# 把 wrangler.jsonc 的 APP_URL、MAIL_FROM 改成线上域名
npm run deploy
```

Google 登录的回调地址：`<APP_URL>/api/auth/callback/google`。
