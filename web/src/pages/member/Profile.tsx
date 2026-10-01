import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CheckCircle2, Clock, KeyRound, Monitor, ShieldCheck, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, Skeleton, StatusBadge } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { Tabs, TabPanel, useTabParam } from '../../components/ui/data';
import { FormField, Input } from '../../components/ui/forms';
import { useAction } from '../../components/ui/overlay';
import { api, useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { date, dateTime, titleCase } from '../../lib/format';

const device = (ua: string) => { const b = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'; const o = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''; return `${b}${o ? ' on ' + o : ''}`; };

export default function Profile() {
  const { me, refresh } = useAuth(); const [tab, setTab] = useTabParam('profile', ['profile', 'security', 'activity']); const act = useApi<any[]>(tab === 'activity' ? '/auth/activity' : null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null); const [code, setCode] = useState(''); const [pw, setPw] = useState({ current: '', next: '', again: '' });
  const [run, busy] = useAction(); if (!me) return null;
  const pwErr = pw.next && pw.next.length < 8 ? 'Use at least 8 characters' : pw.again && pw.next !== pw.again ? 'Passwords do not match' : undefined;
  return <>
    <PageHeader title="Profile & security" description="Your details and how your account is protected." />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'profile', label: 'Profile' }, { key: 'security', label: 'Security' }, { key: 'activity', label: 'Login activity' }]} />
    <TabPanel id="profile" active={tab === 'profile'}><div className="grid max-w-3xl gap-5"><Card><CardHeader title="Personal information" /><dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{[['Name', `${me.first_name ?? ''} ${me.last_name ?? ''}`.trim() || '—'], ['Email', me.email], ['Phone', me.phone ?? '—'], ['Membership ID', me.membership_id ?? 'Not yet issued'], ['Role', titleCase(me.role)], ['Member since', date(me.created_at)]].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl></Card>
      {me.member_id && <Card><CardHeader title="Identity verification" action={<StatusBadge status={me.kyc_status ?? 'draft'} />} /><p className="text-sm text-muted">{me.kyc_status === 'approved' ? 'Your identity is verified. You have full access.' : 'Complete verification to unlock savings, loans and investments.'}</p></Card>}</div></TabPanel>
    <TabPanel id="security" active={tab === 'security'}><div className="grid max-w-3xl gap-5">
      <Card><CardHeader title="Two-factor authentication" subtitle="Adds a 6-digit code from an authenticator app when you sign in." action={me.totp_enabled ? <Badge tone="success" icon={<CheckCircle2 size={13} />}>Enabled</Badge> : <Badge tone="warning" icon={<XCircle size={13} />}>Off</Badge>} />
        {me.totp_enabled ? <Alert tone="success">Your account is protected with two-factor authentication.</Alert> : !setup ? <Button icon={<ShieldCheck size={16} />} loading={busy} onClick={() => run(async () => setSetup(await api('POST', '/auth/2fa/setup')))}>Set up two-factor</Button> :
          <div className="grid gap-5 sm:grid-cols-[auto_1fr]"><div className="w-fit rounded-xl border border-line bg-white p-3"><QRCodeSVG value={setup.otpauthUrl} size={160} /></div>
            <div><ol className="mb-4 list-decimal pl-5 text-sm text-muted"><li>Open Google Authenticator, Microsoft Authenticator or Authy.</li><li>Scan the code, or enter the key <code className="break-all rounded bg-surface2 px-1 font-mono text-ink">{setup.secret}</code>.</li><li>Type the 6-digit code it shows.</li></ol>
              <FormField label="Verification code"><Input inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value)} placeholder="123456" /></FormField>
              <Button loading={busy} disabled={code.length !== 6} onClick={() => run(async () => { await api('POST', '/auth/2fa/enable', { code }); await refresh(); setSetup(null); }, 'Two-factor authentication enabled')}>Verify and enable</Button></div></div>}</Card>
      <Card><CardHeader title="Change password" subtitle={me.password_changed_at ? `Last changed ${date(me.password_changed_at)}` : undefined} />
        <form onSubmit={e => { e.preventDefault(); run(async () => { await api('POST', '/auth/password', { current: pw.current, next: pw.next }); setPw({ current: '', next: '', again: '' }); }, 'Password updated'); }}>
          <FormField label="Current password" required><Input type="password" autoComplete="current-password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} /></FormField>
          <FormField label="New password" required error={pw.next && pw.next.length < 8 ? pwErr : undefined} hint="At least 8 characters"><Input type="password" autoComplete="new-password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} /></FormField>
          <FormField label="Confirm new password" required error={pw.again && pw.next !== pw.again ? 'Passwords do not match' : undefined}><Input type="password" autoComplete="new-password" value={pw.again} onChange={e => setPw({ ...pw, again: e.target.value })} /></FormField>
          <Button type="submit" icon={<KeyRound size={16} />} loading={busy} disabled={!pw.current || pw.next.length < 8 || pw.next !== pw.again}>Update password</Button></form></Card>
      <Card><CardHeader title="Session" /><div className="flex items-start gap-3 text-sm text-muted"><Clock size={18} className="mt-0.5 shrink-0" /><p>For your safety you are signed out after 15 minutes of inactivity. We warn you 60 seconds before.</p></div></Card></div></TabPanel>
    <TabPanel id="activity" active={tab === 'activity'}><Card padded={false}>{act.loading ? <div className="p-5"><Skeleton className="h-32" /></div> : !act.data?.length ? <EmptyState icon={<Monitor size={22} />} title="No login activity yet" /> : <ul className="divide-y divide-line">{act.data.map((a, i) => <li key={i} className="flex items-center gap-3 p-4"><span className={`grid size-9 shrink-0 place-items-center rounded-full ${a.success ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'}`}><Monitor size={17} /></span>
      <div className="min-w-0 flex-1"><p className="font-medium">{a.success ? 'Successful sign-in' : 'Failed sign-in attempt'}</p><p className="truncate text-sm text-muted">{device(a.user_agent ?? '')} · {a.ip ?? 'unknown IP'}</p></div><span className="shrink-0 text-xs text-muted">{dateTime(a.created_at)}</span></li>)}</ul>}</Card>
      <p className="mt-3 text-sm text-muted">Don't recognise an entry? Change your password right away.</p></TabPanel>
  </>;
}
