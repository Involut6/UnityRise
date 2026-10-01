import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import { api, date, hasToken, naira, setToken } from './api';

type Me = { id: string; email: string; role: string; first_name: string | null; membership_id: string | null; kyc_status: string | null; totp_enabled: boolean };
const STAFF = ['loan_officer', 'accountant', 'admin', 'super_admin'];

function useLoad<T>(path: string, deps: unknown[] = []) {
  const [d, setD] = useState<T | null>(null);
  const reload = useCallback(() => { api<T>('GET', path).then(setD).catch(() => setD(null)); }, [path]);
  useEffect(reload, [reload, ...deps]);
  return [d, reload] as const;
}
function Msg({ m }: { m: { t: string; ok?: boolean } | null }) { return m ? <div className={'msg' + (m.ok ? ' ok' : '')}>{m.t}</div> : null; }
/** Form helper: runs an action, shows success/error, then calls onDone. */
function useAction(onDone?: () => void) {
  const [m, setM] = useState<{ t: string; ok?: boolean } | null>(null);
  const run = async (fn: () => Promise<unknown>, ok = 'Done') => { setM(null); try { await fn(); setM({ t: ok, ok: true }); onDone?.(); } catch (e: any) { setM({ t: e.message }); } };
  return [m, run] as const;
}
const F = ({ l, children }: { l: string; children: ReactNode }) => <div><label>{l}</label>{children}</div>;
const val = (e: FormEvent<HTMLFormElement>) => Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;

function Login({ onAuth }: { onAuth: () => void }) {
  const [reg, setReg] = useState(false); const [need2fa, setNeed] = useState(false);
  const [m, run] = useAction();
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const v = val(e);
    run(async () => { const r = await api('POST', reg ? '/auth/register' : '/auth/login', v); if (r.twoFactorRequired) { setNeed(true); throw new Error('Enter your 2FA code'); } setToken(r.token); onAuth(); }); };
  return <div className="card login"><h2>UnityRise CoopManager</h2><form onSubmit={submit}>
    {reg && <><F l="First name"><input name="firstName" required /></F><F l="Last name"><input name="lastName" required /></F><F l="Phone (080…)"><input name="phone" required pattern="(\+234|0)\d{10}" /></F></>}
    <F l="Email"><input name="email" type="email" required /></F><F l="Password"><input name="password" type="password" required minLength={8} /></F>
    {need2fa && <F l="2FA code"><input name="code" inputMode="numeric" autoFocus /></F>}
    <Msg m={m} /><button className="p">{reg ? 'Create account' : 'Sign in'}</button></form>
    <p><button className="s" onClick={() => setReg(!reg)}>{reg ? 'Have an account? Sign in' : 'New member? Register'}</button></p></div>;
}

function Dashboard() {
  const [d] = useLoad<any>('/dashboard');
  const [n] = useLoad<any[]>('/announcements');
  if (!d) return <div className="card">Loading…</div>;
  return <>
    <div className="grid">{[['Savings', d.savings], ['Investments', d.invested], ['Loan outstanding', d.loanOutstanding], ['Returns earned', d.returnsEarned]].map(([k, v]) =>
      <div className="card stat" key={k as string}><small>{k}</small><b>{naira(v as number)}</b></div>)}</div>
    <div className="card"><h3>Upcoming payments</h3>{d.upcoming.length ? <table><tbody>{d.upcoming.map((u: any) => <tr key={u.installment_no}><td>{date(u.due_date)}</td><td>Instalment {u.installment_no}</td><td>{naira(u.amount)}</td></tr>)}</tbody></table> : 'Nothing due.'}</div>
    <div className="card"><h3>Recent transactions</h3><Txns rows={d.recent} /></div>
    <div className="card"><h3>Announcements</h3>{n?.slice(0, 5).map(a => <p key={a.id}><b>{a.title}</b> <span className="tag">{a.kind}</span><br />{a.body}</p>) ?? null}</div></>;
}
const Txns = ({ rows }: { rows: any[] }) => <table><thead><tr><th>Date</th><th>Type</th><th>Details</th><th>Amount</th></tr></thead><tbody>{rows.map((t, i) =>
  <tr key={i}><td>{date(t.created_at)}</td><td>{t.type.replace(/_/g, ' ')}</td><td>{t.narration}</td><td style={{ color: t.direction === 1 ? 'var(--ok)' : 'var(--bad)' }}>{t.direction === 1 ? '+' : '−'}{naira(t.amount)}</td></tr>)}</tbody></table>;

function Kyc({ me, refresh }: { me: Me; refresh: () => void }) {
  const [m, run] = useAction(refresh);
  const fileTo64 = (f: File) => new Promise<string>(res => { const r = new FileReader(); r.onload = () => res((r.result as string).split(',')[1]); r.readAsDataURL(f); });
  const submit = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const fd = new FormData(e.currentTarget); const v = Object.fromEntries(fd) as any;
    run(async () => {
      await api('PUT', '/members/me/kyc', { dateOfBirth: v.dob, bvn: v.bvn, nin: v.nin, address: v.address });
      for (const kind of ['photo', 'id_card', 'signature', 'proof_of_address']) { const f = fd.get(kind) as File; if (f?.size) await api('POST', '/members/me/kyc/documents', { kind, filename: f.name, contentBase64: await fileTo64(f) }); }
      await api('POST', '/members/me/kyc/submit');
    }, 'Submitted for review'); };
  if (me.kyc_status === 'approved') return <div className="card">✅ Verified. Membership ID <b>{me.membership_id}</b></div>;
  if (me.kyc_status === 'submitted') return <div className="card">Your KYC is under review. We'll notify you.</div>;
  return <form className="card" onSubmit={submit}><h3>Complete your KYC</h3>
    <F l="Date of birth"><input type="date" name="dob" required /></F><F l="BVN"><input name="bvn" pattern="\d{11}" required /></F><F l="NIN"><input name="nin" pattern="\d{11}" required /></F><F l="Address"><textarea name="address" required minLength={5} /></F>
    {[['photo', 'Passport photograph'], ['id_card', 'Government ID'], ['signature', 'Signature'], ['proof_of_address', 'Proof of address']].map(([k, l]) => <F key={k} l={l}><input type="file" name={k} accept="image/*,.pdf" required /></F>)}
    <Msg m={m} /><button className="p">Submit</button></form>;
}

function Savings() {
  const [w, reload] = useLoad<any>('/savings'); const [t, reloadT] = useLoad<any[]>('/savings/transactions');
  const [m, run] = useAction(() => { reload(); reloadT(); });
  const dep = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const v = val(e);
    run(async () => { const i = await api('POST', '/payments/initiate', { provider: v.provider, purpose: 'topup', amount: +v.amount }); await api('POST', `/payments/${i.reference}/simulate`); }, 'Deposit received (test gateway)'); };
  return <>
    <div className="grid"><div className="card stat"><small>Savings balance</small><b>{w ? naira(w.balance) : '…'}</b></div>
      <form className="card" onSubmit={dep}><h3>Add money</h3><input name="amount" type="number" min="100" required placeholder="Amount ₦" /><F l="Via"><select name="provider"><option value="paystack">Paystack</option><option value="flutterwave">Flutterwave</option></select></F><button className="p">Deposit</button></form></div>
    <Msg m={m} /><div className="card"><div className="row"><h3 style={{ flex: 1 }}>History</h3><a href="/api/statement?format=csv" onClick={async e => { e.preventDefault(); const r = await fetch('/api/statement?format=csv', { headers: { authorization: 'Bearer ' + sessionStorage.getItem('t') } }); const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = 'statement.csv'; a.click(); }}>Download statement</a></div>{t && <Txns rows={t} />}</div></>;
}

function Loans() {
  const [prods] = useLoad<any[]>('/loans/products'); const [mine, reload] = useLoad<any[]>('/loans/mine'); const [gr, reloadG] = useLoad<any[]>('/loans/guarantee-requests');
  const [sched, setSched] = useState<any[] | null>(null);
  const [m, run] = useAction(() => { reload(); reloadG(); });
  const apply = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const v = val(e);
    run(() => api('POST', '/loans', { productCode: v.productCode, principal: +v.principal, tenorMonths: +v.tenor, purpose: v.purpose, guarantorMembershipIds: [v.g1, v.g2].map(s => s.trim()) }), 'Application sent to guarantors'); };
  return <>
    <form className="card" onSubmit={apply}><h3>Apply for a loan</h3>
      <F l="Type"><select name="productCode">{prods?.map(p => <option key={p.code} value={p.code}>{p.name} — {p.annual_rate_pct}% p.a., up to {p.max_multiple_of_savings}× savings</option>)}</select></F>
      <div className="grid"><F l="Amount ₦"><input name="principal" type="number" min="1000" required /></F><F l="Tenor (months)"><input name="tenor" type="number" min="1" required /></F></div>
      <F l="Purpose"><input name="purpose" /></F><div className="grid"><F l="Guarantor 1 (Membership ID)"><input name="g1" placeholder="UR-2026-00001" required /></F><F l="Guarantor 2"><input name="g2" required /></F></div>
      <Msg m={m} /><button className="p">Apply</button></form>
    {!!gr?.filter(g => g.consent === 'pending').length && <div className="card"><h3>Guarantee requests</h3>{gr.filter(g => g.consent === 'pending').map(g => <div className="row" key={g.loan_id}>
      <span style={{ flex: 1 }}>{g.first_name} {g.last_name} — {naira(g.principal)} over {g.tenor_months} mo</span>
      <button className="s" onClick={() => run(() => api('POST', `/loans/${g.loan_id}/consent`, { consent: 'accepted' }), 'Accepted')}>Accept</button>
      <button className="s" onClick={() => run(() => api('POST', `/loans/${g.loan_id}/consent`, { consent: 'declined' }), 'Declined')}>Decline</button></div>)}</div>}
    <div className="card"><h3>My loans</h3><table><tbody>{mine?.map(l => <tr key={l.id}><td>{date(l.created_at)}</td><td>{l.product_code}</td><td>{naira(l.principal)}</td><td><span className="tag">{l.status.replace('_', ' ')}</span></td>
      <td>{l.status === 'active' && <button className="s" onClick={() => api('GET', `/loans/${l.id}/schedule`).then(setSched)}>Schedule</button>}</td></tr>)}</tbody></table></div>
    {sched && <div className="card"><h3>Repayment schedule</h3><table><thead><tr><th>#</th><th>Due</th><th>Principal</th><th>Interest</th><th>Penalty</th><th>Paid</th></tr></thead><tbody>{sched.map(s => <tr key={s.installment_no}><td>{s.installment_no}</td><td>{date(s.due_date)}</td><td>{naira(s.principal_due)}</td><td>{naira(s.interest_due)}</td><td>{naira(s.penalty)}</td><td>{naira(s.paid)}</td></tr>)}</tbody></table></div>}</>;
}

function Invest() {
  const [list, reload] = useLoad<any[]>('/investments'); const [pf, reloadP] = useLoad<any[]>('/investments/portfolio');
  const [m, run] = useAction(() => { reload(); reloadP(); });
  return <><Msg m={m} /><div className="grid">{list?.filter(s => s.status === 'open').map(s => <form className="card" key={s.id} onSubmit={e => { e.preventDefault(); run(() => api('POST', `/investments/${s.id}/subscribe`, { amount: +val(e).amount }), 'Subscribed'); }}>
    <h3>{s.title}</h3><p><span className="tag">{s.category.replace('_', ' ')}</span> <span className="tag">{s.risk_profile} risk</span><br />{s.projected_roi_pct}% over {s.duration_months} months<br />{naira(s.raised)} of {naira(s.target_amount)} raised</p>
    <input name="amount" type="number" min={s.min_amount} placeholder={`Min ${naira(s.min_amount)}`} required /><button className="p">Invest from savings</button></form>)}</div>
    <div className="card"><h3>My portfolio</h3><table><tbody>{pf?.map(x => <tr key={x.id}><td>{x.title}</td><td>{naira(x.amount)}</td><td>{x.projected_roi_pct}%</td><td><span className="tag">{x.status}</span></td><td>{x.payout ? naira(x.payout) : ''}</td></tr>)}</tbody></table></div></>;
}

function Community() {
  const [polls, reload] = useLoad<any[]>('/polls'); const [inbox, reloadI] = useLoad<any[]>('/notifications');
  const [m, run] = useAction(reload);
  return <><Msg m={m} /><div className="card"><h3>Polls & resolutions</h3>{polls?.map(p => <div key={p.id} style={{ marginBottom: 14 }}><b>{p.question}</b> {p.is_resolution && <span className="tag">resolution</span>}<div className="row">{p.options.map((o: string, i: number) =>
    <button key={i} className="s" disabled={!p.open || p.my_vote != null} style={p.my_vote === i ? { borderColor: 'var(--brand)' } : {}} onClick={() => run(() => api('POST', `/polls/${p.id}/vote`, { optionIndex: i }), 'Vote recorded')}>{o} ({p.tally[i] ?? 0})</button>)}</div></div>)}</div>
    <div className="card"><h3>Notifications</h3>{inbox?.map(n => <p key={n.id} style={{ opacity: n.read_at ? .55 : 1 }}><b>{n.title}</b> — {n.body} {!n.read_at && <button className="s" onClick={() => api('POST', `/notifications/${n.id}/read`).then(reloadI)}>Mark read</button>}</p>)}</div></>;
}

function Security({ me, refresh }: { me: Me; refresh: () => void }) {
  const [s, setS] = useState<any>(null); const [m, run] = useAction(refresh);
  return <div className="card"><h3>Two-factor authentication</h3>{me.totp_enabled ? 'Enabled ✅' : <>
    <button className="p" onClick={() => api('POST', '/auth/2fa/setup').then(setS)}>Set up authenticator app</button>
    {s && <form onSubmit={e => { e.preventDefault(); run(() => api('POST', '/auth/2fa/enable', { code: val(e).code }), '2FA enabled'); }}><p>Add this key to Google Authenticator: <code>{s.secret}</code></p><input name="code" placeholder="6-digit code" required /><button className="p">Confirm</button></form>}</>}<Msg m={m} /></div>;
}

function Admin({ me }: { me: Me }) {
  const [sum, reloadS] = useLoad<any>('/admin/summary'); const [kyc, reloadK] = useLoad<any[]>('/members?status=submitted'); const [q, reloadQ] = useLoad<any[]>('/loans/queue');
  const [m, run] = useAction(() => { reloadS(); reloadK(); reloadQ(); }); const [rep, setRep] = useState<any[] | null>(null); const [audit, setAudit] = useState<any[] | null>(null);
  const dl = async (k: string) => { const r = await fetch(`/api/reports/${k}?format=csv`, { headers: { authorization: 'Bearer ' + sessionStorage.getItem('t') } }); const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = k + '.csv'; a.click(); };
  const admin = ['admin', 'super_admin'].includes(me.role);
  return <><Msg m={m} />{sum && <div className="grid">{[['Members', sum.members], ['Pending KYC', sum.pending_kyc], ['Total savings', naira(sum.savings)], ['Active loans', sum.active_loans], ['Pending loans', sum.pending_loans]].map(([k, v]) => <div className="card stat" key={k as string}><small>{k}</small><b>{v}</b></div>)}</div>}
    {admin && <div className="card"><h3>KYC review</h3>{kyc?.length ? <table><tbody>{kyc.map(k => <tr key={k.id}><td>{k.first_name} {k.last_name}</td><td>{date(k.created_at)}</td><td className="row">
      <button className="s" onClick={() => run(() => api('POST', `/members/${k.id}/review`, { decision: 'approve' }), 'Approved')}>Approve</button>
      <button className="s" onClick={() => { const note = prompt('Reason for rejection?'); if (note) run(() => api('POST', `/members/${k.id}/review`, { decision: 'reject', note }), 'Rejected'); }}>Reject</button></td></tr>)}</tbody></table> : 'None pending.'}</div>}
    <div className="card"><h3>Loan queue</h3>{q?.map(l => <div className="row" key={l.id}><span style={{ flex: 1 }}>{l.first_name} {l.last_name} · {l.product_code} · {naira(l.principal)} · {l.status} ({l.approvals}/2)</span>
      {l.status === 'under_review' && <><button className="s" onClick={() => run(() => api('POST', `/loans/${l.id}/review`, { decision: 'approve' }), 'Approved')}>Approve</button><button className="s" onClick={() => { const note = prompt('Reason?'); if (note) run(() => api('POST', `/loans/${l.id}/review`, { decision: 'reject', note })); }}>Reject</button></>}
      {l.status === 'approved' && <button className="s" onClick={() => run(() => api('POST', `/loans/${l.id}/disburse`), 'Disbursed')}>Disburse</button>}</div>)}{!q?.length && 'Queue empty.'}</div>
    {admin && <>
      <form className="card" onSubmit={e => { e.preventDefault(); const v = val(e); run(() => api('POST', '/investments', { title: v.title, category: v.category, targetAmount: +v.target, minAmount: +v.min, durationMonths: +v.dur, projectedRoiPct: +v.roi, riskProfile: v.risk }), 'Scheme created (draft; needs a second admin to approve)'); }}><h3>New investment scheme</h3>
        <div className="grid"><F l="Title"><input name="title" required /></F><F l="Category"><select name="category">{['real_estate', 'treasury_bills', 'agriculture', 'equipment_leasing', 'business_financing'].map(c => <option key={c}>{c}</option>)}</select></F>
          <F l="Target ₦"><input name="target" type="number" required /></F><F l="Min ₦"><input name="min" type="number" defaultValue={0} /></F><F l="Months"><input name="dur" type="number" required /></F><F l="Projected ROI %"><input name="roi" type="number" step="0.1" required /></F>
          <F l="Risk"><select name="risk"><option>low</option><option>medium</option><option>high</option></select></F></div><button className="p">Create</button></form>
      <form className="card" onSubmit={e => { e.preventDefault(); const v = val(e); run(() => api('POST', '/announcements', v), 'Sent to all members'); }}><h3>Announcement</h3><F l="Title"><input name="title" required /></F><F l="Message"><textarea name="body" required /></F><F l="Kind"><select name="kind"><option>notice</option><option>meeting</option><option>agm</option></select></F><button className="p">Broadcast</button></form></>}
    <div className="card"><h3>Reports</h3><div className="row">{['loan-book', 'member-savings', 'investments', 'cash-flow'].map(k => <span key={k} className="row"><button className="s" onClick={() => api('GET', `/reports/${k}`).then(setRep).catch(() => setRep(null))}>{k}</button><button className="s" onClick={() => dl(k)}>CSV</button></span>)}
      {admin && <button className="s" onClick={() => api('GET', '/admin/audit').then(setAudit)}>Audit trail</button>}</div>
      {rep && <table><thead><tr>{Object.keys(rep[0] ?? {}).map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{rep.map((r, i) => <tr key={i}>{Object.values(r).map((v: any, j) => <td key={j}>{String(v ?? '')}</td>)}</tr>)}</tbody></table>}
      {audit && <table><thead><tr><th>When</th><th>Actor</th><th>Action</th></tr></thead><tbody>{audit.map(a => <tr key={a.id}><td>{new Date(a.created_at).toLocaleString()}</td><td>{a.actor}</td><td>{a.action}</td></tr>)}</tbody></table>}</div></>;
}

export default function App() {
  const [me, setMe] = useState<Me | null>(null); const [auth, setAuth] = useState(hasToken()); const [tab, setTab] = useState('home');
  const refresh = useCallback(() => { api<Me>('GET', '/auth/me').then(setMe).catch(() => setAuth(false)); }, []);
  useEffect(() => { if (auth) refresh(); }, [auth, refresh]);
  if (!auth) return <Login onAuth={() => setAuth(true)} />;
  if (!me) return <main><div className="card">Loading…</div></main>;
  const staff = STAFF.includes(me.role); const approved = me.kyc_status === 'approved';
  const tabs: [string, string][] = staff && !me.membership_id ? [['admin', 'Admin'], ['security', 'Security']] : approved
    ? [['home', 'Home'], ['savings', 'Savings'], ['loans', 'Loans'], ['invest', 'Invest'], ['community', 'Community'], ...(staff ? [['admin', 'Admin'] as [string, string]] : []), ['security', 'Security']] : [['kyc', 'Verification'], ['security', 'Security']];
  const cur = tabs.some(t => t[0] === tab) ? tab : tabs[0][0];
  return <><header><b>UnityRise</b><nav>{tabs.map(([k, l]) => <button key={k} className={cur === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</nav>
    <span>{me.first_name ?? me.email}</span><button className="s" onClick={() => { setToken(''); setAuth(false); setMe(null); }}>Sign out</button></header>
    <main>{cur === 'home' && <Dashboard />}{cur === 'kyc' && <Kyc me={me} refresh={refresh} />}{cur === 'savings' && <Savings />}{cur === 'loans' && <Loans />}{cur === 'invest' && <Invest />}{cur === 'community' && <Community />}{cur === 'admin' && <Admin me={me} />}{cur === 'security' && <Security me={me} refresh={refresh} />}</main></>;
}
