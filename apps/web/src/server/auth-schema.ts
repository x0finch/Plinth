/** 影响数据库表结构的登录配置。运行时配置和迁移脚本共用，保证表结构一致。 */
import type { BetterAuthOptions } from 'better-auth';
import { anonymous, emailOTP } from 'better-auth/plugins';
import type { OtpType } from './mail';

export const schemaPlugins = (hooks: { sendOtp?: (email: string, otp: string, type: OtpType) => Promise<void>; onLink?: (from: string, to: string) => Promise<void> } = {}) => [
  emailOTP({
    otpLength: 6,
    expiresIn: 600,
    // 注册后验证邮箱也用验证码，不发链接
    overrideDefaultEmailVerification: true,
    async sendVerificationOTP({ email, otp, type }) {
      await hooks.sendOtp?.(email, otp, type);
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
