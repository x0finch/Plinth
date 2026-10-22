/** 发验证码邮件：线上用 Resend；本地没配时打印到终端。 */
import { env } from 'cloudflare:workers';

export async function sendOtpMail(email: string, otp: string) {
  if (!env.RESEND_API_KEY) {
    console.log(`[dev] ${email} 的验证码：${otp}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: email,
      subject: `Plinth 登录验证码 ${otp}`,
      text: `你的 Plinth 登录验证码是 ${otp}，10 分钟内有效。如果不是你本人操作，请忽略这封邮件。`,
    }),
  });
  if (!res.ok) throw new Error(`验证码邮件发送失败（${res.status}）`);
}
