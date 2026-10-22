import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LoaderIcon } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { Logo } from '@/components/site/SiteHeader';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { authClient } from '@/lib/auth-client';
import { queryClient, useMe } from '@/lib/query';

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const me = useMe();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guest = me.data?.user?.isAnonymous;

  const done = async () => {
    await queryClient.invalidateQueries();
    await navigate({ to: redirect?.startsWith('/') ? redirect : '/projects' });
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
    setBusy(false);
    if (r.error) setError(r.error.message ?? '发送失败，请稍后再试');
    else setStep('code');
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await authClient.signIn.emailOtp({ email, otp: code.trim() });
    setBusy(false);
    if (r.error) setError(r.error.message === 'Invalid OTP' ? '验证码不对' : r.error.message ?? '登录失败');
    else await done();
  };

  const google = () => authClient.signIn.social({ provider: 'google', callbackURL: redirect?.startsWith('/') ? redirect : '/projects' });

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <Logo />
        <div>
          <h1 className="text-xl font-semibold">登录</h1>
          <p className="mt-1 text-sm text-muted-foreground">{guest ? '登录后，试用期间的方案会转到你的账号里。' : '没有账号会自动创建。'}</p>
        </div>
        {step === 'email' ? (
          <form onSubmit={send} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="email">邮箱</FieldLabel>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
            </Field>
            <Button type="submit" className="w-full" disabled={busy || !email}>{busy && <LoaderIcon className="animate-spin" />}发送验证码</Button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="code">验证码</FieldLabel>
              <Input id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} required autoFocus value={code} onChange={e => setCode(e.target.value)} className="font-mono tracking-widest" />
              <FieldDescription>已发到 {email}，10 分钟内有效。<button type="button" className="underline" onClick={() => setStep('email')}>换个邮箱</button></FieldDescription>
            </Field>
            <Button type="submit" className="w-full" disabled={busy || code.length < 6}>{busy && <LoaderIcon className="animate-spin" />}登录</Button>
          </form>
        )}
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
