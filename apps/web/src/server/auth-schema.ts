/** Auth options that affect the database schema. Shared by the runtime config and the migration script so the schema stays consistent. */
import type { BetterAuthOptions } from 'better-auth';
import { anonymous, emailOTP } from 'better-auth/plugins';
import type { OtpType } from './mail';

export const schemaPlugins = (hooks: { sendOtp?: (email: string, otp: string, type: OtpType) => Promise<void>; onLink?: (from: string, to: string) => Promise<void> } = {}) => [
  emailOTP({
    otpLength: 6,
    expiresIn: 600,
    // Email verification after sign-up also uses an OTP, not a link
    overrideDefaultEmailVerification: true,
    async sendVerificationOTP({ email, otp, type }) {
      await hooks.sendOtp?.(email, otp, type);
    },
  }),
  // Try first, sign in later: when an anonymous user signs in, their projects move to the real account
  anonymous({
    emailDomainName: 'guest.plinth.invalid',
    generateName: () => '访客',
    async onLinkAccount({ anonymousUser, newUser }) {
      await hooks.onLink?.(anonymousUser.user.id, newUser.user.id);
    },
  }),
] satisfies BetterAuthOptions['plugins'];
