/**
 * 发验证码邮件：线上用 Cloudflare Email Service（send_email 绑定，需要 Workers 付费版和已接入的发信域名）；
 * 没设 MAIL_FROM 时（本地开发）打印到终端。
 */
import { env } from 'cloudflare:workers';

export async function sendOtpMail(email: string, otp: string) {
  if (!env.MAIL_FROM) {
    console.log(`[dev] ${email} 的验证码：${otp}`);
    return;
  }
  try {
    await env.EMAIL.send({
      from: env.MAIL_FROM,
      to: email,
      subject: `Plinth 登录验证码 ${otp}`,
      text: `你的 Plinth 登录验证码是 ${otp}，10 分钟内有效。如果不是你本人操作，请忽略这封邮件。`,
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    console.error('验证码邮件发送失败', code, e);
    throw new Error(code === 'E_SENDER_NOT_VERIFIED' ? '发信域名还没在 Cloudflare Email Service 接入' : '验证码邮件发送失败，请稍后再试');
  }
}
