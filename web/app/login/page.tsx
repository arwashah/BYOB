'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { continueWithGoogle, emailLoginLink, logInWithPassword, setGuest, signUp, useAuth } from '@/lib/cloud';
import { googleEnabled } from '@/lib/supabase';
import { useSavedProfile } from '@/lib/useProfile';
import { Card, Loading, Page, button, buttonGhost, input, label } from '@/components/ui';
import { IconArrowRight } from '@/components/icons';

type Mode = 'login' | 'signup';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const auth = useAuth();
  const saved = useSavedProfile();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'password' | 'link' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(params.get('error_description'));
  const [notice, setNotice] = useState<string | null>(null);

  // Logged in and their row is loaded: skip onboarding if they already finished it.
  useEffect(() => {
    if (auth.ready && auth.user) router.replace(saved ? '/gaps' : '/');
  }, [auth.ready, auth.user, saved, router]);

  if (!auth.enabled) {
    return (
      <Card className="space-y-4">
        <p className="text-[15px] text-ink">Logins aren&apos;t switched on for this copy of BYOB yet.</p>
        <p className="text-[14px] text-ink-2">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>web/.env.local</code>, then restart.
        </p>
        <Link href="/" className={button}>Try as guest <IconArrowRight width={18} height={18} /></Link>
      </Card>
    );
  }
  if (auth.user) return <Loading />; // loading their saved answers, then redirecting

  const validEmail = /^\S+@\S+\.\S+$/.test(email);

  const submit = async () => {
    setBusy('password');
    setError(null);
    setNotice(null);
    if (mode === 'login') {
      setError(await logInWithPassword(email, password));
    } else {
      const r = await signUp(email, password);
      if (r === 'confirm') setNotice(`Check ${email} for a link to confirm your account, then come back and log in.`);
      else setError(r);
    }
    setBusy(null);
  };

  const sendLink = async () => {
    setBusy('link');
    setError(null);
    setNotice(null);
    const r = await emailLoginLink(email);
    if (r) setError(r);
    else setNotice(`We sent a login link to ${email}. Open it on this device.`);
    setBusy(null);
  };

  const google = async () => {
    setBusy('google');
    setError(await continueWithGoogle()); // on success the browser leaves for Google
    setBusy(null);
  };

  return (
    <>
      <Card>
        <div role="tablist" aria-label="Log in or create an account" className="grid grid-cols-2 gap-1 rounded-full bg-sunken p-1">
          {(['login', 'signup'] as Mode[]).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => { setMode(m); setError(null); setNotice(null); }}
              className={`pressable rounded-full py-2.5 text-[14px] font-semibold ${mode === m ? 'bg-surface text-ink shadow-[0_1px_3px_rgba(17,19,17,0.12)]' : 'text-ink-2'}`}
            >
              {m === 'login' ? 'Log in' : 'Create account'}
            </button>
          ))}
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (validEmail && password.length >= 6) submit();
          }}
        >
          <div>
            <label className={label} htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value.trim())} />
          </div>
          <div>
            <label className={label} htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className={input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="password-hint"
            />
            {mode === 'signup' && <p id="password-hint" className="mt-2 text-[13px] text-ink-3">At least 6 characters.</p>}
          </div>
          <button type="submit" disabled={!validEmail || password.length < 6 || busy !== null} className={`${button} w-full`}>
            {busy === 'password' ? (mode === 'login' ? 'Logging in…' : 'Creating your account…') : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <div aria-live="polite">
          {error && <p role="alert" className="rise mt-4 rounded-2xl bg-rose-soft p-4 text-[14px] font-medium text-rose">{error}</p>}
          {notice && <p className="rise mt-4 rounded-2xl bg-sage-soft p-4 text-[14px] font-medium text-sage">{notice}</p>}
        </div>

        <div className="my-5 flex items-center gap-3 text-[13px] text-ink-3">
          <span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" />
        </div>

        <div className="space-y-3">
          <button onClick={sendLink} disabled={!validEmail || busy !== null} className={`${buttonGhost} w-full`}>
            {busy === 'link' ? 'Sending…' : 'Email me a login link'}
          </button>
          {googleEnabled && (
            <button onClick={google} disabled={busy !== null} className={`${buttonGhost} w-full`}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
                <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z" />
                <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6H1.4a12 12 0 0 0 0 10.9l4-3.1z" />
                <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8z" />
              </svg>
              {busy === 'google' ? 'Opening Google…' : 'Continue with Google'}
            </button>
          )}
        </div>
      </Card>

      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <Link href="/" onClick={() => setGuest(true)} className="pressable text-[15px] font-semibold text-brand">
          Try as guest
        </Link>
        <p className="max-w-sm text-[13px] text-ink-3">
          Guests are saved on this device only. With an account, your profile and results follow you. We never store your policy PDFs.
        </p>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Page eyebrow="Your account" title="Welcome back." subtitle="Log in to pick up where you left off, on any device.">
      <Suspense fallback={<Loading />}>
        <LoginForm />
      </Suspense>
    </Page>
  );
}
