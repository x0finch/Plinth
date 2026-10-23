/** Send OTP emails: Resend in production; printed to the terminal locally when not configured. */
import { env } from 'cloudflare:workers';

export type OtpType = 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';

const PURPOSE: Record<OtpType, string> = {
  'sign-in': '登录',
  'email-verification': '验证邮箱',
  'forget-password': '重设密码',
  'change-email': '更换邮箱',
};

/** Email sign-in is available when Resend is configured, or always in local development (codes go to the terminal). */
export const mailEnabled = () => !!(env.RESEND_API_KEY && env.MAIL_FROM) || import.meta.env.DEV;

export async function sendOtpMail(email: string, otp: string, type: OtpType = 'sign-in') {
  const purpose = PURPOSE[type] ?? '登录';
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    // Never pretend a code was sent in production
    if (!import.meta.env.DEV) throw new Error('邮件服务还没配置，请用其他方式登录');
    console.log(`[dev] OTP for ${email}: ${otp} (${type})`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: email,
      subject: `Plinth ${purpose}验证码 ${otp}`,
      text: `你的 Plinth ${purpose}验证码是 ${otp}，10 分钟内有效。如果不是你本人操作，请忽略这封邮件。`,
    }),
  });
  if (!res.ok) throw new Error(`验证码邮件发送失败（${res.status}）`);
}
