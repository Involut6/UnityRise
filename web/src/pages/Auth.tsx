import { FormEvent, useState } from 'react';
import { Eye, EyeOff, Lock, PiggyBank, ShieldCheck, TrendingUp, HandCoins } from 'lucide-react';
import { Button, Alert } from '../components/ui/primitives';
import { FormField, Input } from '../components/ui/forms';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Auth() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login'); const [show, setShow] = useState(false);
  const [need2fa, setNeed2fa] = useState(false); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ firstName: '', lastName: '', phone: '', email: '', password: '', code: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(s => ({ ...s, [k]: e.target.value }));
  const errors: Record<string, string> = {};
  if (!/^\S+@\S+\.\S+$/.test(f.email)) errors.email = 'Enter a valid email address';
  if (f.password.length < 8) errors.password = 'Use at least 8 characters';
  if (mode === 'register') { if (!f.firstName.trim()) errors.firstName = 'Required'; if (!f.lastName.trim()) errors.lastName = 'Required'; if (!/^(\+234|0)\d{10}$/.test(f.phone)) errors.phone = 'Use a Nigerian number, e.g. 08012345678'; }
  const show_ = (k: string) => (touched[k] ? errors[k] : undefined);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(''); setTouched({ email: true, password: true, firstName: true, lastName: true, phone: true });
    if (Object.keys(errors).length) return;
    setBusy(true);
    try {
      const body = mode === 'login' ? { email: f.email, password: f.password, ...(need2fa && { code: f.code }) } : { email: f.email, password: f.password, firstName: f.firstName, lastName: f.lastName, phone: f.phone };
      const r = await api<any>('POST', mode === 'login' ? '/auth/login' : '/auth/register', body);
      if (r.twoFactorRequired) { setNeed2fa(true); return; }
      await signIn(r.token);
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  };
  return <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
    <aside className="hidden flex-col justify-between bg-brand p-12 text-on-brand lg:flex">
      <div className="flex items-center gap-2.5 text-xl font-bold"><span className="grid size-10 place-items-center rounded-xl bg-white/15"><ShieldCheck size={22} /></span>UnityRise</div>
      <div><h1 className="max-w-md text-4xl font-bold leading-tight tracking-tight">Your cooperative, in one secure place.</h1>
        <ul className="mt-8 grid max-w-md gap-4 text-[15px]">{[[PiggyBank, 'Save regularly and watch your balance grow'], [HandCoins, 'Apply for loans with guarantors, fully online'], [TrendingUp, 'Invest in vetted cooperative schemes'], [Lock, 'Bank-grade security with two-factor sign-in']].map(([I, t]: any) => <li key={t} className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/15"><I size={18} /></span>{t}</li>)}</ul></div>
      <p className="text-sm opacity-70">UnityRise Multipurpose Cooperative Society Ltd.</p></aside>
    <main className="flex items-center justify-center px-5 py-10"><div className="w-full max-w-sm">
      <div className="mb-8 flex items-center gap-2.5 text-xl font-bold lg:hidden"><span className="grid size-10 place-items-center rounded-xl bg-brand text-on-brand"><ShieldCheck size={22} /></span>UnityRise</div>
      <h2 className="text-2xl font-bold tracking-tight">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
      <p className="mb-6 mt-1 text-muted">{mode === 'login' ? 'Sign in to manage your savings, loans and investments.' : 'Register as a member. You will verify your identity next.'}</p>
      {err && <div className="mb-4"><Alert tone="danger">{err}</Alert></div>}
      <form onSubmit={submit} noValidate>
        {mode === 'register' && <><div className="grid grid-cols-2 gap-3"><FormField label="First name" required error={show_('firstName')}><Input autoComplete="given-name" value={f.firstName} onChange={set('firstName')} onBlur={() => setTouched(t => ({ ...t, firstName: true }))} /></FormField>
          <FormField label="Last name" required error={show_('lastName')}><Input autoComplete="family-name" value={f.lastName} onChange={set('lastName')} onBlur={() => setTouched(t => ({ ...t, lastName: true }))} /></FormField></div>
          <FormField label="Phone number" required error={show_('phone')}><Input type="tel" autoComplete="tel" inputMode="tel" placeholder="08012345678" value={f.phone} onChange={set('phone')} onBlur={() => setTouched(t => ({ ...t, phone: true }))} /></FormField></>}
        <FormField label="Email" required error={show_('email')}><Input type="email" autoComplete="email" value={f.email} onChange={set('email')} onBlur={() => setTouched(t => ({ ...t, email: true }))} /></FormField>
        <FormField label="Password" required error={show_('password')} hint={mode === 'register' ? 'At least 8 characters' : undefined}>
          <div className="relative"><Input type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className="pr-11" value={f.password} onChange={set('password')} onBlur={() => setTouched(t => ({ ...t, password: true }))} />
            <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></FormField>
        {need2fa && <FormField label="Authentication code" hint="Open your authenticator app and enter the 6-digit code"><Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} data-autofocus autoFocus value={f.code} onChange={set('code')} /></FormField>}
        <Button type="submit" block size="lg" loading={busy}>{mode === 'login' ? (need2fa ? 'Verify and sign in' : 'Sign in') : 'Create account'}</Button></form>
      <p className="mt-6 text-center text-sm text-muted">{mode === 'login' ? 'New to UnityRise?' : 'Already a member?'}{' '}
        <button className="font-semibold text-brand hover:underline" onClick={() => { setMode(m => (m === 'login' ? 'register' : 'login')); setErr(''); setNeed2fa(false); setTouched({}); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
    </div></main></div>;
}
