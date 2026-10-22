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

## 部署（Cloudflare Workers 免费版，GitHub Actions 自动部署）

`.github/workflows/deploy.yml`：
- 拉取请求和推送：类型检查、核心包测试、主题颜色检查、构建
- 推送到 `main`：检查通过后迁移线上 D1 → 部署 → 把下面的密钥同步到 Worker

D1 数据库 `plinth` 已建好（ID 写在 `apps/web/wrangler.jsonc`），Token 要来自同一个 Cloudflare 账号。

### 在 GitHub 上配置

仓库 Settings → Secrets and variables → Actions：

**Secrets**

| 名称 | 说明 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 必填。Cloudflare → My Profile → API Tokens → Create Token，用 “Edit Cloudflare Workers” 模板，再加上 Account → D1 → Edit |
| `CLOUDFLARE_ACCOUNT_ID` | 必填。Cloudflare 后台 Workers & Pages 页右侧的 Account ID |
| `BETTER_AUTH_SECRET` | 必填。登录会话签名，32 位以上随机串 |
| `KEY_ENCRYPTION_SECRET` | 必填。加密用户的大模型密钥，24 位以上随机串。**设好后不要改**，改了已保存的模型密钥就解不开 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 可选。回调地址：`<网址>/api/auth/callback/google` |

**Variables**

| 名称 | 说明 |
|---|---|
| `MAIL_FROM` | 邮箱验证码登录需要。发件人，如 `Plinth <noreply@你的域名>`；不填则线上只能访客试用和 Google 登录 |
| `APP_URL` | 可选。绑定自己的域名时填，如 `https://plinth.example.com`；不填时按访问的网址推断 |

### 邮箱验证码登录（Cloudflare Email Service）

验证码邮件用 Cloudflare 自己的 Email Service（`wrangler.jsonc` 里的 `send_email` 绑定）发送，需要：
1. Workers 付费版（每月 5 美元，含每月 3000 封邮件）。免费版只能发给账号里验证过的地址，发不了给用户
2. 一个用 Cloudflare DNS 的域名：Cloudflare 后台 → Compute → Email Service → Email Sending → Onboard Domain
3. GitHub Variables 里设 `MAIL_FROM`，发件地址用这个域名

不设 `MAIL_FROM` 时线上只能访客试用和 Google 登录；本地开发不设，验证码打印在终端。

配好后推送到 `main`，或在 Actions 页手动运行 `deploy`。第一次部署后网址是 `https://plinth.<你的子域>.workers.dev`。
