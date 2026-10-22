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

## 部署（Cloudflare Workers 免费版，全程在网页上完成）

用 Cloudflare 的 Workers Builds：连上 GitHub 仓库后，每次推送到 `main` 自动构建、跑数据库迁移、部署。不需要本地环境，也不需要自己管 API Token。

D1 数据库 `plinth` 已建好（ID 写在 `apps/web/wrangler.jsonc`），要在同一个 Cloudflare 账号里部署。

### 1. 连上仓库

Cloudflare 后台 → Workers & Pages → Create → Import a repository → 选 `x0finch/Plinth`：

| 设置 | 填写 |
|---|---|
| Project name | `plinth`（必须和 `wrangler.jsonc` 的 `name` 一致） |
| Production branch | `main` |
| Build command | `npm ci && npm run build -w @plinth/web` |
| Deploy command | `npm run deploy:ci -w @plinth/web`（先迁移数据库，再部署） |
| Root directory | 留空（仓库根目录） |

保存后会跑第一次部署，完成后得到 `https://plinth.<你的子域>.workers.dev`。

### 2. 设置密钥

Worker → Settings → Variables and Secrets，添加后会自动生效：

| 名称 | 类型 | 说明 |
|---|---|---|
| `BETTER_AUTH_SECRET` | Secret | 必填。登录会话签名，用密码生成器生成 32 位以上随机串 |
| `KEY_ENCRYPTION_SECRET` | Secret | 必填。加密用户的大模型密钥，24 位以上随机串。**设好后不要改**，改了已保存的模型密钥就解不开 |
| `RESEND_API_KEY` | Secret | 邮箱验证码登录需要（resend.com）。不配则线上只能访客试用和 Google 登录 |
| `MAIL_FROM` | Text | 发件人，如 `Plinth <noreply@你的域名>`，域名要先在 Resend 验证 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Secret | 可选。回调地址：`<网址>/api/auth/callback/google` |
| `APP_URL` | Text | 只有绑定自己的域名时才填，如 `https://plinth.example.com`；不填时按访问的网址自动推断 |

`wrangler.jsonc` 开了 `keep_vars`，后台设置的变量不会被下次部署覆盖。

### 3. 之后

推送到 `main` 就自动部署。构建日志在 Worker → Deployments 里看。

如果第一次部署卡在数据库迁移（提示没有 D1 权限），到 My Profile → API Tokens 给 Workers Builds 自动创建的那个 Token 加上 “D1 编辑” 权限，再点 Retry。
