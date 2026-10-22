/**
 * 登录：Better Auth，邮箱验证码 + Google，支持先试用（匿名）后登录。
 * 免费版每次请求约 10 ms CPU：不做密码登录（密码哈希太耗 CPU）；会话用签名 cookie 缓存，大多数请求不查库。
 */
import { betterAuth } from 'better-auth';
import { env } from 'cloudflare:workers';
import { sendOtpMail } from './mail';
import { schemaPlugins } from './auth-schema';
import { transferOwnership } from './repo';

function create() {
  const google = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: 'select_account' as const } }
    : undefined;
  return betterAuth({
    appName: 'Plinth',
    baseURL: env.APP_URL,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    database: env.DB,
    trustedOrigins: [env.APP_URL],
    emailAndPassword: { enabled: false },
    socialProviders: google,
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    user: { deleteUser: { enabled: true } },
    // 邮箱验证码登录没有名字：默认用邮箱前缀
    databaseHooks: {
      user: { create: { before: async u => ({ data: { ...u, name: u.name || (u.email?.split('@')[0] ?? '') } }) } },
    },
    // 限流交给 Cloudflare 的限流绑定，这里不再查库计数
    rateLimit: { enabled: false },
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
    plugins: schemaPlugins({ sendOtp: sendOtpMail, onLink: transferOwnership }),
  });
}

let instance: ReturnType<typeof create> | null = null;
/** 每个隔离环境只初始化一次 */
export const auth = () => (instance ??= create());
export const googleEnabled = () => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
