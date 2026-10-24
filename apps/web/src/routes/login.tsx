import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { LoaderIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Logo } from '@/features/site/SiteHeader';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authClient } from '@/lib/auth-client';
import { m } from '@/lib/i18n';
import { derivePassword, MIN_PASSWORD } from '@/lib/password';
import { queryClient, useMe } from '@/lib/query';

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: Login,
});

/**
 * Two sign-in methods:
 * - Code: enter email and receive a code; an account is created if none exists
 * - Password: after sign-up the email is verified with a code; forgotten passwords are reset with a code too
 */
type Step = { tab: 'code'; at: 'email' | 'code' } | { tab: 'password'; at: 'sign-in' | 'sign-up' | 'verify' | 'forgot' | 'reset' };

const MESSAGE: Record<string, () => string> = {
  INVALID_EMAIL_OR_PASSWORD: m.login_error_invalid_credentials,
  INVALID_OTP: m.login_error_invalid_otp,
  OTP_EXPIRED: m.login_error_otp_expired,
  TOO_MANY_ATTEMPTS: m.login_error_too_many_attempts,
  USER_ALREADY_EXISTS: m.login_error_user_exists,
};
const message = (e: { code?: string; message?: string; status?: number }, fallback: string) =>
  (e.code && MESSAGE[e.code]?.()) || (e.status === 429 ? m.login_error_rate_limited() : e.message) || fallback;

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

  /** Run a step: show spinner, clear error, show the reason on failure */
  const run =
    (label: string, fn: () => Promise<{ error?: { code?: string; message?: string; status?: number } | null } | void>, fallback: string) =>
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

  // Code sign-in
  const sendCode = run(
    m.login_busy_sending(),
    async () => {
      const r = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
      if (!r.error) go({ tab: 'code', at: 'code' });
      return r;
    },
    m.login_send_failed(),
  );
  const signInCode = run(
    m.login_busy_signing_in(),
    async () => {
      const r = await authClient.signIn.emailOtp({ email, otp: code.trim() });
      if (!r.error) await done();
      return r;
    },
    m.login_sign_in_failed(),
  );

  // Password sign-in: slow hashing runs on device and takes a few hundred ms
  const signIn = run(
    m.login_busy_hashing(),
    async () => {
      const r = await authClient.signIn.email({ email, password: await derivePassword(email, password) });
      if (r.error?.code === 'EMAIL_NOT_VERIFIED') {
        go({ tab: 'password', at: 'verify' });
        return;
      }
      if (!r.error) await done();
      return r;
    },
    m.login_sign_in_failed(),
  );
  const signUp = run(
    m.login_busy_hashing(),
    async () => {
      const r = await authClient.signUp.email({ email, password: await derivePassword(email, password), name: email.split('@')[0] });
      if (r.error) return r;
      // Without a mail service there is no verification step: sign-up returns a session right away
      if (r.data?.token) await done();
      else go({ tab: 'password', at: 'verify' });
      return r;
    },
    m.login_sign_up_failed(),
  );
  const verify = run(
    m.login_busy_verifying(),
    async () => {
      const r = await authClient.emailOtp.verifyEmail({ email, otp: code.trim() });
      if (!r.error) await done();
      return r;
    },
    m.login_verify_failed(),
  );
  const forgot = run(
    m.login_busy_sending(),
    async () => {
      const r = await authClient.emailOtp.requestPasswordReset({ email });
      if (!r.error) go({ tab: 'password', at: 'reset' });
      return r;
    },
    m.login_send_failed(),
  );
  const reset = run(
    m.login_busy_hashing(),
    async () => {
      const derived = await derivePassword(email, password);
      const r = await authClient.emailOtp.resetPassword({ email, otp: code.trim(), password: derived });
      if (r.error) return r;
      const s = await authClient.signIn.email({ email, password: derived });
      if (!s.error) await done();
      return s;
    },
    m.login_reset_failed(),
  );

  const google = () => authClient.signIn.social({ provider: 'google', callbackURL: redirect?.startsWith('/') ? redirect : '/projects' });

  const submit = (label: string, disabled: boolean) => (
    <Button type="submit" className="w-full" disabled={!!busy || disabled}>
      {busy && <LoaderIcon className="animate-spin" />}
      {busy ?? label}
    </Button>
  );
  const emailField = (
    <Field>
      <FieldLabel htmlFor="email">{m.login_email()}</FieldLabel>
      <Input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
    </Field>
  );
  const passwordField = (label: string, isNew: boolean) => (
    <Field>
      <FieldLabel htmlFor="password">{label}</FieldLabel>
      <Input
        id="password"
        type="password"
        autoComplete={isNew ? 'new-password' : 'current-password'}
        required
        minLength={isNew ? MIN_PASSWORD : undefined}
        value={password}
        onChange={e => setPassword(e.target.value)}
      />
      {isNew && <FieldDescription>{m.login_password_hint({ min: MIN_PASSWORD })}</FieldDescription>}
    </Field>
  );
  const codeField = (hint: React.ReactNode) => (
    <Field>
      <FieldLabel htmlFor="code">{m.login_code()}</FieldLabel>
      <Input
        id="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        required
        autoFocus
        value={code}
        onChange={e => setCode(e.target.value)}
        className="font-mono tracking-widest"
      />
      <FieldDescription>{hint}</FieldDescription>
    </Field>
  );
  const link = (label: string, s: Step) => (
    <Button type="button" variant="link" className="h-auto p-0" onClick={() => go(s)}>
      {label}
    </Button>
  );
  const pw = step.tab === 'password' ? step.at : null;
  // Production without a mail service: codes can't be delivered, so only email + password (without
  // verification or password reset) and Google are offered
  const mailOff = me.data?.mailEnabled === false;
  useEffect(() => {
    if (mailOff && step.tab === 'code') setStep({ tab: 'password', at: 'sign-in' });
  }, [mailOff]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <Logo />
        <div>
          <h1 className="text-xl font-semibold">{m.login_title()}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{guest ? m.login_guest_hint() : mailOff ? null : m.login_auto_create_hint()}</p>
        </div>
        <Tabs value={step.tab} onValueChange={v => go(v === 'code' ? { tab: 'code', at: 'email' } : { tab: 'password', at: 'sign-in' })}>
          {!mailOff && (
            <TabsList className="w-full">
              <TabsTrigger value="code">{m.login_tab_code()}</TabsTrigger>
              <TabsTrigger value="password">{m.login_tab_password()}</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="code" className="pt-4">
            {step.tab === 'code' && step.at === 'email' && (
              <form onSubmit={sendCode} className="space-y-4">
                {emailField}
                {submit(m.login_send_code(), !email)}
              </form>
            )}
            {step.tab === 'code' && step.at === 'code' && (
              <form onSubmit={signInCode} className="space-y-4">
                {codeField(
                  <>
                    {m.login_code_sent({ email })}
                    {link(m.login_change_email(), { tab: 'code', at: 'email' })}
                  </>,
                )}
                {submit(m.login_submit(), code.length < 6)}
              </form>
            )}
          </TabsContent>

          <TabsContent value="password" className="pt-4">
            {pw === 'sign-in' && (
              <form onSubmit={signIn} className="space-y-4">
                {emailField}
                {passwordField(m.login_password(), false)}
                {submit(m.login_submit(), !email || !password)}
                <p className="flex justify-between text-sm text-muted-foreground">
                  {link(m.login_sign_up_link(), { tab: 'password', at: 'sign-up' })}
                  {!mailOff && link(m.login_forgot_link(), { tab: 'password', at: 'forgot' })}
                </p>
              </form>
            )}
            {pw === 'sign-up' && (
              <form onSubmit={signUp} className="space-y-4">
                {emailField}
                {passwordField(m.login_set_password(), true)}
                {submit(m.login_sign_up(), !email || password.length < MIN_PASSWORD)}
                <p className="text-sm text-muted-foreground">
                  {m.login_have_account()}
                  {link(m.login_go_sign_in(), { tab: 'password', at: 'sign-in' })}
                </p>
              </form>
            )}
            {pw === 'verify' && (
              <form onSubmit={verify} className="space-y-4">
                {codeField(
                  <>
                    {m.login_verify_hint_before({ email })}
                    {link(m.login_verify_hint_link(), { tab: 'password', at: 'sign-in' })}
                    {m.login_verify_hint_after()}
                  </>,
                )}
                {submit(m.login_verify_and_sign_in(), code.length < 6)}
              </form>
            )}
            {pw === 'forgot' && (
              <form onSubmit={forgot} className="space-y-4">
                {emailField}
                {submit(m.login_send_code(), !email)}
                <p className="text-sm text-muted-foreground">{link(m.login_back_to_sign_in(), { tab: 'password', at: 'sign-in' })}</p>
              </form>
            )}
            {pw === 'reset' && (
              <form onSubmit={reset} className="space-y-4">
                {codeField(<>{m.login_code_sent({ email })}</>)}
                {passwordField(m.login_new_password(), true)}
                {submit(m.login_reset_and_sign_in(), code.length < 6 || password.length < MIN_PASSWORD)}
              </form>
            )}
          </TabsContent>
        </Tabs>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        {me.data?.googleEnabled && (
          <>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <Separator className="flex-1" />
              {m.login_or()}
              <Separator className="flex-1" />
            </div>
            <Button variant="outline" className="w-full" onClick={google}>
              {m.login_google()}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
