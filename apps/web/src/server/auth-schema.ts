/** 影响数据库表结构的登录配置。运行时配置和迁移脚本共用，保证表结构一致。 */
import type { BetterAuthOptions } from 'better-auth';
import { anonymous, emailOTP } from 'better-auth/plugins';

export const schemaPlugins = (hooks: { sendOtp?: (email: string, otp: string) => Promise<void>; onLink?: (from: string, to: string) => Promise<void> } = {}) => [
  emailOTP({
    otpLength: 6,
    expiresIn: 600,
    async sendVerificationOTP({ email, otp }) {
      await hooks.sendOtp?.(email, otp);
    },
  }),
  // 先试用、后登录：匿名用户登录后，名下方案转给正式账号
  anonymous({
    emailDomainName: 'guest.plinth.invalid',
    generateName: () => '访客',
    async onLinkAccount({ anonymousUser, newUser }) {
      await hooks.onLink?.(anonymousUser.user.id, newUser.user.id);
    },
  }),
] satisfies BetterAuthOptions['plugins'];
