import { FormEvent, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, Check, Compass, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { AskFlowMark } from '@/components/askflow-shell';

async function authRequest(path: string, body: Record<string, string>) {
  const response = await fetch(path, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) { const payload = await response.json().catch(() => ({})); throw new Error(payload.error || 'We could not complete that request.'); }
  return response.json();
}

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const isSignup = mode === 'signup';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!email || !password || (isSignup && !name)) { setError(isSignup ? 'Add your name, email, and a password to continue.' : 'Add your email and password to continue.'); return; }
    setPending(true);
    try { await authRequest(isSignup ? '/api/auth/signup' : '/api/auth/login', isSignup ? { name, email, password } : { email, password }); setLocation('/dashboard'); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Something went wrong. Try again.'); }
    finally { setPending(false); }
  }

  return (
    <div className="askflow-noise flex min-h-[100dvh] bg-background">
      <section className="relative hidden w-[43%] flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div className="absolute -right-24 top-24 size-80 rounded-full border border-primary-foreground/10" /><div className="absolute -right-12 top-36 size-56 rounded-full border border-primary-foreground/10" />
        <Link href="/login" data-testid="link-auth-brand" className="relative flex items-center gap-2.5"><AskFlowMark small /><span className="text-[17px] font-extrabold tracking-[-.04em]">askflow</span></Link>
        <div className="relative max-w-md animate-rise">
          <Compass className="mb-8 size-9 text-accent" strokeWidth={1.4} />
          <h1 className="font-editorial text-6xl leading-[.98] tracking-[-.04em]">A quieter place<br />to think clearly.</h1>
          <p className="mt-7 max-w-sm text-sm leading-7 text-primary-foreground/70">AskFlow keeps the useful parts of AI close at hand, without turning every thought into a thread to manage.</p>
        </div>
        <div className="relative flex items-center gap-2 text-xs text-primary-foreground/50"><span className="size-1.5 rounded-full bg-accent" />Private by default · Built for long-form thinking</div>
      </section>
      <section className="flex flex-1 flex-col px-6 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between lg:justify-end"><Link href="/login" data-testid="link-mobile-brand" className="flex items-center gap-2 lg:hidden"><AskFlowMark small /><span className="text-[15px] font-extrabold tracking-[-.04em]">askflow</span></Link><Link href="/" data-testid="link-return-home" className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Back to home</Link></div>
        <div className="mx-auto flex w-full max-w-[390px] flex-1 flex-col justify-center py-16 animate-rise">
          <div className="mb-9"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-primary">{isSignup ? 'Start a workspace' : 'Welcome back'}</p><h2 data-testid="text-auth-title" className="mt-3 font-editorial text-5xl leading-none tracking-[-.04em]">{isSignup ? 'Make room for better questions.' : 'Good to see you again.'}</h2><p className="mt-4 text-sm leading-6 text-muted-foreground">{isSignup ? 'Your thoughts deserve a calm place to land.' : 'Pick up wherever your thinking left off.'}</p></div>
          <form onSubmit={submit} className="space-y-4">
            {isSignup && <label className="block"><span className="mb-2 block text-xs font-bold">Your name</span><input data-testid="input-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="How should we call you?" className="h-12 w-full rounded-lg border border-input bg-card px-4 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10" /></label>}
            <label className="block"><span className="mb-2 block text-xs font-bold">Email address</span><div className="relative"><Mail className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input data-testid="input-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" className="h-12 w-full rounded-lg border border-input bg-card pl-11 pr-4 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10" /></div></label>
            <label className="block"><span className="mb-2 block text-xs font-bold">Password</span><div className="relative"><LockKeyhole className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input data-testid="input-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isSignup ? 'new-password' : 'current-password'} placeholder="At least 8 characters" className="h-12 w-full rounded-lg border border-input bg-card pl-11 pr-11 text-sm outline-none transition placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/10" /><button type="button" data-testid="button-toggle-password" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>
            {error && <div data-testid="status-auth-error" className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3 text-xs leading-5 text-destructive">{error}</div>}
            <button type="submit" data-testid="button-submit-auth" disabled={pending} className="group mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 disabled:opacity-60">{pending ? 'Working…' : isSignup ? 'Create workspace' : 'Sign in'}{!pending && <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />}</button>
          </form>
          {isSignup && <div className="mt-6 space-y-2 text-[11px] text-muted-foreground"><p className="flex items-center gap-2"><Check className="size-3.5 text-primary" />Your conversations stay yours.</p><p className="flex items-center gap-2"><Check className="size-3.5 text-primary" />No noisy feed or public profile.</p></div>}
          <p className="mt-9 text-center text-xs text-muted-foreground">{isSignup ? 'Already have an account?' : 'New to AskFlow?'} <Link href={isSignup ? '/login' : '/signup'} data-testid="link-switch-auth" className="font-bold text-primary hover:underline">{isSignup ? 'Sign in' : 'Create an account'}</Link></p>
        </div>
        <p className="text-center font-mono-ui text-[9px] uppercase tracking-[.12em] text-muted-foreground/60">AskFlow AI · Clear answers, less clutter</p>
      </section>
    </div>
  );
}