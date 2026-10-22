import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { Logo } from '@/components/site/SiteHeader';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/lib/auth-client';
import { derivePassword, MIN_PASSWORD } from '@/lib/password';
import { queryClient, useMe } from '@/lib/query';

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: Login,
});

/**
 * 两种登录方式：
 * - 验证码：输入邮箱收验证码，没有账号会自动创建
 * - 密码：注册后用验证码验证邮箱；忘记密码也用验证码重设
 */
type Step =
  | { tab: 'code'; at: 'email' | 'code' }
  | { tab: 'password'; at: 'sign-in' | 'sign-up' | 'verify' | 'forgot' | 'reset' };

const MESSAGE: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: '邮箱或密码不对',
  INVALID_OTP: '验证码不对',
  OTP_EXPIRED: '验证码过期了，请重新获取',
  TOO_MANY_ATTEMPTS: '尝试次数太多，请重新获取验证码',
  USER_ALREADY_EXISTS: '这个邮箱已经注册过，请直接登录',
};
const message = (e: { code?: string; message?: string; status?: number }, fallback: string) =>
  (e.code && MESSAGE[e.code]) || (e.status === 429 ? '操作太频繁，请稍后再试' : e.message) || fallback;

function Login() {
  const { redirect } = Route.useSearch();
  const me = useMe();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>({ tab: 'code', at: 'email' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const guest = me.data?.user?.isAnonymous;

  const done = async () => {
    await queryClient.invalidateQueries();
    await navigate({ to: redirect?.startsWith('/') ? redirect : '/projects' });
  };

  /** 跑一个步骤：转圈、清错误、出错显示原因 */
  const run = (label: string, fn: () => Promise<{ error?: { code?: string; message?: string; status?: number } | null } | void>, fallback: string) =>
    async (e: React.FormEvent) => {
      e.preventDefault();
      setBusy(label);
      setError(null);
      try {
        const r = await fn();
        if (r?.error) setError(message(r.error, fallback));
      } finally {
        setBusy(null);
      }
    };
  const go = (s: Step) => {
    setError(null);
    setCode('');
    setStep(s);
  };

  // 验证码登录
  const sendCode = run('发送中', async () => {
    const r = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
    if (!r.error) go({ tab: 'code', at: 'code' });
    return r;
  }, '发送失败，请稍后再试');
  const signInCode = run('登录中', async () => {
    const r = await authClient.signIn.emailOtp({ email, otp: code.trim() });
    if (!r.error) await done();
    return r;
  }, '登录失败');

  // 密码登录：慢哈希在设备上做，要几百毫秒
  const signIn = run('正在加密密码', async () => {
    const r = await authClient.signIn.email({ email, password: await derivePassword(email, password) });
    if (r.error?.code === 'EMAIL_NOT_VERIFIED') {
      go({ tab: 'password', at: 'verify' });
      return;
    }
    if (!r.error) await done();
    return r;
  }, '登录失败');
  const signUp = run('正在加密密码', async () => {
    const r = await authClient.signUp.email({ email, password: await derivePassword(email, password), name: email.split('@')[0] });
    if (!r.error) go({ tab: 'password', at: 'verify' });
    return r;
  }, '注册失败');
  const verify = run('验证中', async () => {
    const r = await authClient.emailOtp.verifyEmail({ email, otp: code.trim() });
    if (!r.error) await done();
    return r;
  }, '验证失败');
  const forgot = run('发送中', async () => {
    const r = await authClient.emailOtp.requestPasswordReset({ email });
    if (!r.error) go({ tab: 'password', at: 'reset' });
    return r;
  }, '发送失败，请稍后再试');
  const reset = run('正在加密密码', async () => {
    const derived = await derivePassword(email, password);
    const r = await authClient.emailOtp.resetPassword({ email, otp: code.trim(), password: derived });
    if (r.error) return r;
    const s = await authClient.signIn.email({ email, password: derived });
    if (!s.error) await done();
    return s;
  }, '重设失败');

  const google = () => authClient.signIn.social({ provider: 'google', callbackURL: redirect?.startsWith('/') ? redirect : '/projects' });

  const submit = (label: string, disabled: boolean) => (
    <Button type="submit" className="w-full" disabled={!!busy || disabled}>
      {busy && <LoaderIcon className="animate-spin" />}{busy ?? label}
    </Button>
  );
  const emailField = (
    <Field>
      <FieldLabel htmlFor="email">邮箱</FieldLabel>
      <Input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
    </Field>
  );
  const passwordField = (label: string, isNew: boolean) => (
    <Field>
      <FieldLabel htmlFor="password">{label}</FieldLabel>
      <Input id="password" type="password" autoComplete={isNew ? 'new-password' : 'current-password'} required minLength={isNew ? MIN_PASSWORD : undefined}
        value={password} onChange={e => setPassword(e.target.value)} />
      {isNew && <FieldDescription>至少 {MIN_PASSWORD} 位。密码只在你的设备上加密，不会原样发给服务器。</FieldDescription>}
    </Field>
  );
  const codeField = (hint: React.ReactNode) => (
    <Field>
      <FieldLabel htmlFor="code">验证码</FieldLabel>
      <Input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} required autoFocus value={code}
        onChange={e => setCode(e.target.value)} className="font-mono tracking-widest" />
      <FieldDescription>{hint}</FieldDescription>
    </Field>
  );
  const link = (label: string, s: Step) => <Button type="button" variant="link" className="h-auto p-0" onClick={() => go(s)}>{label}</Button>;
  const pw = step.tab === 'password' ? step.at : null;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <Logo />
        <div>
          <h1 className="text-xl font-semibold">登录</h1>
          <p className="mt-1 text-sm text-muted-foreground">{guest ? '登录后，试用期间的方案会转到你的账号里。' : '用验证码登录时，没有账号会自动创建。'}</p>
        </div>
        <Tabs value={step.tab} onValueChange={v => go(v === 'code' ? { tab: 'code', at: 'email' } : { tab: 'password', at: 'sign-in' })}>
          <TabsList className="w-full">
            <TabsTrigger value="code">验证码</TabsTrigger>
            <TabsTrigger value="password">密码</TabsTrigger>
          </TabsList>

          <TabsContent value="code" className="pt-4">
            {step.tab === 'code' && step.at === 'email' && (
              <form onSubmit={sendCode} className="space-y-4">{emailField}{submit('发送验证码', !email)}</form>
            )}
            {step.tab === 'code' && step.at === 'code' && (
              <form onSubmit={signInCode} className="space-y-4">
                {codeField(<>已发到 {email}，10 分钟内有效。{link('换个邮箱', { tab: 'code', at: 'email' })}</>)}
                {submit('登录', code.length < 6)}
              </form>
            )}
          </TabsContent>

          <TabsContent value="password" className="pt-4">
            {pw === 'sign-in' && (
              <form onSubmit={signIn} className="space-y-4">
                {emailField}{passwordField('密码', false)}
                {submit('登录', !email || !password)}
                <p className="flex justify-between text-sm text-muted-foreground">
                  {link('注册新账号', { tab: 'password', at: 'sign-up' })}{link('忘记密码', { tab: 'password', at: 'forgot' })}
                </p>
              </form>
            )}
            {pw === 'sign-up' && (
              <form onSubmit={signUp} className="space-y-4">
                {emailField}{passwordField('设置密码', true)}
                {submit('注册', !email || password.length < MIN_PASSWORD)}
                <p className="text-sm text-muted-foreground">已有账号？{link('去登录', { tab: 'password', at: 'sign-in' })}</p>
              </form>
            )}
            {pw === 'verify' && (
              <form onSubmit={verify} className="space-y-4">
                {codeField(<>验证码已发到 {email}，验证邮箱后即可登录。如果这个邮箱已经注册过，请{link('直接登录', { tab: 'password', at: 'sign-in' })}。</>)}
                {submit('验证并登录', code.length < 6)}
              </form>
            )}
            {pw === 'forgot' && (
              <form onSubmit={forgot} className="space-y-4">
                {emailField}{submit('发送验证码', !email)}
                <p className="text-sm text-muted-foreground">{link('返回登录', { tab: 'password', at: 'sign-in' })}</p>
              </form>
            )}
            {pw === 'reset' && (
              <form onSubmit={reset} className="space-y-4">
                {codeField(<>已发到 {email}，10 分钟内有效。</>)}
                {passwordField('新密码', true)}
                {submit('重设并登录', code.length < 6 || password.length < MIN_PASSWORD)}
              </form>
            )}
          </TabsContent>
        </Tabs>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {me.data?.googleEnabled && (
          <>
            <div className="flex items-center gap-3 text-xs text-muted-foreground"><Separator className="flex-1" />或<Separator className="flex-1" /></div>
            <Button variant="outline" className="w-full" onClick={google}>用 Google 登录</Button>
          </>
        )}
      </div>
    </div>
  );
}
