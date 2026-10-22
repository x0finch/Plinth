// 端到端：邮箱密码注册（验证码验证邮箱）→ 退出 → 密码登录 → 错密码 → 忘记密码重设 → 原始密码从不发给服务器
// 用法：DEV_LOG=<npm run dev 的输出文件> node e2e/auth.e2e.mjs（本地不配 RESEND_API_KEY，验证码打印在日志里）
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3000';
if (!process.env.DEV_LOG) throw new Error('需要 DEV_LOG：dev 服务器的日志文件，用来读验证码');
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) process.exitCode = 1;
};
const otpOf = async (email, purpose) => {
  for (let i = 0; i < 20; i++) {
    const m = [...readFileSync(process.env.DEV_LOG, 'utf8').matchAll(new RegExp(`${email.replace(/[.+]/g, '\\$&')} 的验证码：(\\d{6})（${purpose}）`, 'g'))].at(-1);
    if (m) return m[1];
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`没收到 ${email} 的${purpose}验证码`);
};

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext()).newPage();
const SECRET = 'correct horse battery 9';
const NEW_SECRET = 'another horse staple 7';
const leaked = [];
p.on('request', r => { const body = r.postData() ?? ''; if (body.includes(SECRET) || body.includes(NEW_SECRET)) leaked.push(r.url()); });
const me = () => p.evaluate(async () => (await (await fetch('/api/me')).json()).user);
const signOut = () => p.evaluate(() => fetch('/api/auth/sign-out', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }));

// 登录接口每个 IP 每分钟限 10 次：前面的测试用过一些，等一个窗口再开始
await new Promise(r => setTimeout(r, 61000));

// 先以访客身份建一个方案
await p.goto(BASE, { waitUntil: 'networkidle' });
await p.getByRole('button', { name: '从零开始' }).click();
await p.waitForURL(/\/p\//);
const guestProject = p.url().match(/\/p\/([^/?]+)/)[1];

// 注册
const email = `pw${Date.now()}@example.com`;
await p.goto(`${BASE}/login`);
await p.getByRole('tab', { name: '密码' }).click();
await p.getByRole('button', { name: '注册新账号' }).click();
await p.getByLabel('邮箱').fill(email);
await p.getByLabel('设置密码').fill(SECRET);
await p.getByRole('button', { name: '注册' }).click();
await p.locator('input#code').waitFor({ timeout: 20000 });
check(true, '注册后要求用验证码验证邮箱');
await p.locator('input#code').fill(await otpOf(email, '验证邮箱'));
await p.getByRole('button', { name: '验证并登录' }).click();
await p.waitForURL(/\/projects/);
let u = await me();
check(u.email === email && !u.isAnonymous, `验证后已登录：${u.email}`);
const mine = await p.evaluate(async () => (await (await fetch('/api/projects')).json()).map(x => x.id));
check(mine.includes(guestProject), '访客期间的方案转到了新账号');

// 退出后用密码登录；错密码报错
await signOut();
await p.goto(`${BASE}/login`);
await p.getByRole('tab', { name: '密码' }).click();
await p.getByLabel('邮箱').fill(email);
await p.locator('input#password').fill('wrong password 1');
await p.getByRole('button', { name: '登录', exact: true }).click();
check(await p.getByRole('alert').filter({ hasText: '邮箱或密码不对' }).waitFor({ timeout: 20000 }).then(() => true, () => false), '错密码：提示“邮箱或密码不对”');
await p.locator('input#password').fill(SECRET);
await p.getByRole('button', { name: '登录', exact: true }).click();
await p.waitForURL(/\/projects/);
check((await me()).email === email, '密码登录成功');

// 忘记密码：验证码 + 新密码
await signOut();
await p.goto(`${BASE}/login`);
await p.getByRole('tab', { name: '密码' }).click();
await p.getByRole('button', { name: '忘记密码' }).click();
await p.getByLabel('邮箱').fill(email);
await p.getByRole('button', { name: '发送验证码' }).click();
await p.locator('input#code').waitFor({ timeout: 20000 });
await p.locator('input#code').fill(await otpOf(email, '重设密码'));
await p.getByLabel('新密码').fill(NEW_SECRET);
await p.getByRole('button', { name: '重设并登录' }).click();
await p.waitForURL(/\/projects/);
check((await me()).email === email, '重设密码后自动登录');
await signOut();
const old = await p.evaluate(async ([e, pw]) => {
  const { derivePassword } = await import('/src/lib/password.ts');
  const r = await fetch('/api/auth/sign-in/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: await derivePassword(e, pw) }) });
  return r.status;
}, [email, SECRET]);
check(old === 401, `旧密码失效（${old}）`);

// 只用验证码登录过的账号，也能用“忘记密码”设一个密码
// 登录接口每个 IP 每分钟限 10 次，上面已经用了将近 10 次：等过这一分钟
await new Promise(r => setTimeout(r, 61000));
const otpUser = `otp${Date.now()}@example.com`;
await p.goto(`${BASE}/login`);
await p.getByLabel('邮箱').fill(otpUser);
await p.getByRole('button', { name: '发送验证码' }).click();
await p.locator('input#code').fill(await otpOf(otpUser, '登录'));
await p.getByRole('button', { name: '登录', exact: true }).click();
await p.waitForURL(/\/projects/);
await signOut();
await p.goto(`${BASE}/login`);
await p.getByRole('tab', { name: '密码' }).click();
await p.getByRole('button', { name: '忘记密码' }).click();
await p.getByLabel('邮箱').fill(otpUser);
await p.getByRole('button', { name: '发送验证码' }).click();
await p.locator('input#code').fill(await otpOf(otpUser, '重设密码'));
await p.getByLabel('新密码').fill(NEW_SECRET);
await p.getByRole('button', { name: '重设并登录' }).click();
await p.waitForURL(/\/projects/);
check((await me()).email === otpUser, '验证码账号设了密码并登录');

check(leaked.length === 0, leaked.length ? `原始密码发给了：${leaked.join(', ')}` : '原始密码从没发给服务器');
await b.close();
