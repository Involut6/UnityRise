import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, CircleDot, Download, Flag, Lock, Pause, Pencil, Play, Users } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, ErrorState, PageSkeleton, ProgressBar, StatusBadge } from '../../components/ui/primitives';
import { ChartCard, PageHeader, StatCard } from '../../components/ui/dashboard';
import { DataTable, FilterBar, TabPanel, Tabs, TableCard, useTabParam } from '../../components/ui/data';
import { Drawer, useAction, useConfirm } from '../../components/ui/overlay';
import { FormField, Input, MoneyInput, SearchInput, Select, Textarea } from '../../components/ui/forms';
import MatureModal from '../../components/features/MatureModal';
import { api, invalidate, useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { CATEGORY_LABEL, date, dateTime, downloadText, monthLabel, naira, pct, titleCase, toCsv } from '../../lib/format';
import { RISK_TONE } from '../member/Investments';

const FIELD: Record<string, string> = { title: 'Title', category: 'Category', description: 'Description', targetAmount: 'Target amount', minAmount: 'Minimum investment', durationMonths: 'Duration', projectedRoiPct: 'Projected return', riskProfile: 'Risk profile', status: 'Status' };
const show = (k: string, v: unknown): string => {
  if (v == null || v === '') return '—';
  switch (k) {
    case 'targetAmount': case 'minAmount': return naira(v as number);
    case 'projectedRoiPct': return pct(v as number);
    case 'durationMonths': return `${v} months`;
    case 'category': return CATEGORY_LABEL[v as string] ?? String(v);
    case 'description': { const t = String(v); return t.length > 70 ? t.slice(0, 70) + '…' : t; }
    default: return titleCase(String(v));
  }
};

function EditDrawer({ s, onClose, onSaved }: { s: any; onClose: () => void; onSaved: () => void }) {
  const confirm = useConfirm(); const [run, busy] = useAction(() => { invalidate(); onSaved(); onClose(); });
  const [f, setF] = useState({ title: s.title as string, category: s.category as string, riskProfile: s.risk_profile as string, description: (s.description ?? '') as string,
    targetAmount: Number(s.target_amount) as number | '', minAmount: Number(s.min_amount) as number | '', durationMonths: Number(s.duration_months) as number | '', projectedRoiPct: Number(s.projected_roi_pct) as number | '', reason: '' });
  const matured = s.locks.matured, live = s.status !== 'draft';
  const orig: Record<string, unknown> = { title: s.title, category: s.category, riskProfile: s.risk_profile, description: s.description ?? '', targetAmount: Number(s.target_amount), minAmount: Number(s.min_amount), durationMonths: Number(s.duration_months), projectedRoiPct: Number(s.projected_roi_pct) };
  const changes = Object.keys(orig).filter(k => (f as any)[k] !== '' && (f as any)[k] !== orig[k]);
  const errs: Record<string, string> = {};
  if (f.title.trim().length < 3) errs.title = 'At least 3 characters';
  if (f.targetAmount === '' || f.targetAmount < s.locks.minTarget) errs.targetAmount = s.locks.minTarget ? `Cannot be below the ₦${Number(s.locks.minTarget).toLocaleString()} already raised` : 'Enter a target';
  else if (f.minAmount !== '' && f.minAmount > f.targetAmount) errs.minAmount = 'Cannot exceed the target';
  if (f.durationMonths === '' || f.durationMonths < 1) errs.durationMonths = 'At least 1 month';
  if (f.projectedRoiPct === '' || f.projectedRoiPct < 0 || f.projectedRoiPct > 200) errs.projectedRoiPct = 'Between 0 and 200%';
  if (live && changes.length && f.reason.trim().length < 3) errs.reason = 'Explain why you are changing a live scheme';
  const invalid = Object.keys(errs).some(k => k !== 'reason' || changes.length) || !changes.length;
  const save = async () => {
    const body: Record<string, unknown> = Object.fromEntries(changes.map(k => [k, (f as any)[k]])); if (f.reason.trim()) body.reason = f.reason.trim();
    const c = await confirm({ title: 'Save these changes?', confirmLabel: 'Save changes', message: <><ul className="mb-2 grid gap-1">{changes.map(k => <li key={k}><b className="text-ink">{FIELD[k]}</b>: {show(k, orig[k])} → <b className="text-ink">{show(k, (f as any)[k])}</b></li>)}</ul>{live && s.locks.hasInvestors && <p>Investors are notified of material changes. This is recorded in the scheme's history.</p>}</> });
    if (c.ok) run(() => api('PATCH', `/investments/${s.id}`, body), 'Scheme updated');
  };
  const dis = (k: string) => matured && k !== 'description';
  return <Drawer title="Edit scheme" subtitle={s.title} onClose={onClose} width="max-w-xl" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={invalid} onClick={save}>Review & save</Button></>}>
    {matured ? <div className="mb-4"><Alert tone="warning" title="Matured: financially final">Returns have been paid out, so only the description can be edited.</Alert></div>
      : live && <div className="mb-4"><Alert tone="info" title="This scheme is live">{s.locks.hasInvestors ? `${s.investors} investor${s.investors === 1 ? ' has' : 's have'} invested ${naira(s.raised)}. ` : ''}Changes to return, duration, risk or minimum notify investors and are recorded with your reason.</Alert></div>}
    <FormField label="Title" required error={errs.title}><Input value={f.title} disabled={dis('title')} onChange={e => setF({ ...f, title: e.target.value })} /></FormField>
    <div className="grid gap-x-4 sm:grid-cols-2"><FormField label="Category"><Select value={f.category} disabled={dis('category')} onChange={e => setF({ ...f, category: e.target.value })}>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></FormField>
      <FormField label="Risk profile"><Select value={f.riskProfile} disabled={dis('riskProfile')} onChange={e => setF({ ...f, riskProfile: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select></FormField>
      <FormField label="Target amount" required error={errs.targetAmount} hint={s.locks.minTarget ? `Raised so far: ${naira(s.locks.minTarget)}` : undefined}><MoneyInput value={f.targetAmount} disabled={dis('targetAmount')} onChange={v => setF({ ...f, targetAmount: v })} /></FormField>
      <FormField label="Minimum per member" error={errs.minAmount}><MoneyInput value={f.minAmount} disabled={dis('minAmount')} onChange={v => setF({ ...f, minAmount: v })} /></FormField>
      <FormField label="Duration (months)" required error={errs.durationMonths}><Input type="number" min={1} value={f.durationMonths} disabled={dis('durationMonths')} onChange={e => setF({ ...f, durationMonths: e.target.value === '' ? '' : Number(e.target.value) })} /></FormField>
      <FormField label="Projected return (%)" required error={errs.projectedRoiPct} hint="An estimate shown to members as 'projected'"><Input type="number" step="0.1" value={f.projectedRoiPct} disabled={dis('projectedRoiPct')} onChange={e => setF({ ...f, projectedRoiPct: e.target.value === '' ? '' : Number(e.target.value) })} /></FormField></div>
    <FormField label="Description"><Textarea className="min-h-32" value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></FormField>
    {(live || matured) && <FormField label="Reason for the change" required error={changes.length ? errs.reason : undefined} hint="Stored in the scheme's history with who and when"><Textarea value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} /></FormField>}
    {changes.length > 0 && <p className="text-sm text-muted">{changes.length} field{changes.length === 1 ? '' : 's'} changed: {changes.map(k => FIELD[k]).join(', ')}</p>}
  </Drawer>;
}

const KEYS = ['overview', 'investors', 'returns', 'history'];
export default function AdminInvestmentDetail() {
  const { id } = useParams(); const { me, can, isAdmin } = useAuth(); const d = useApi<any>(`/investments/${id}/manage`); const [tab, setTab] = useTabParam('overview', KEYS);
  const [edit, setEdit] = useState(false); const [mature, setMature] = useState(false); const [q, setQ] = useState(''); const confirm = useConfirm(); const [run, busy] = useAction(() => { invalidate(); d.reload(); });
  const rows = useMemo(() => (d.data?.subscribers ?? []).filter((x: any) => !q || `${x.first_name} ${x.last_name} ${x.membership_id}`.toLowerCase().includes(q.toLowerCase())), [d.data, q]);
  if (d.loading) return <PageSkeleton />;
  if (d.error || !d.data) return <ErrorState message={d.error?.message ?? 'Scheme not found'} onRetry={d.reload} />;
  const s = d.data, super_ = can('super_admin'), live = ['open', 'closed'].includes(s.status), matured = s.status === 'matured';
  const roiNote = Number(s.projected_roi_pct);
  const setStatus = async (action: 'close' | 'reopen') => {
    const c = await confirm({ title: action === 'close' ? 'Close this scheme to new investors?' : 'Reopen this scheme?', confirmLabel: action === 'close' ? 'Close scheme' : 'Reopen', requireReason: true, reasonLabel: 'Reason (kept in the history)',
      message: action === 'close' ? 'Members will no longer be able to invest. Existing investments are unaffected.' : `Members will be able to invest again, up to the ${naira(s.remaining)} that remains.` });
    if (c.ok) run(() => api('POST', `/investments/${s.id}/status`, { action, reason: c.reason }), action === 'close' ? 'Scheme closed' : 'Scheme reopened');
  };
  const timeline = [{ t: 'Scheme created', d: s.created_at, by: s.created_by_email }, ...(s.opened_at ? [{ t: 'Approved and opened to members', d: s.opened_at, by: s.approved_by_email }] : []), ...(matured ? [{ t: `Matured: ${s.confirmedReturnPct}% confirmed return paid out`, d: s.matured_at, by: null }] : [{ t: 'Expected maturity', d: s.expectedMaturity, by: null, future: true }])];
  return <>
    <PageHeader title={s.title} breadcrumbs={[{ label: 'Investments', to: '/admin/investments' }, { label: s.title }]}
      description={<span className="flex flex-wrap items-center gap-2"><Badge tone="brand">{CATEGORY_LABEL[s.category]}</Badge><Badge tone={RISK_TONE[s.risk_profile as keyof typeof RISK_TONE]}>{s.risk_profile} risk</Badge><StatusBadge status={s.status} />{matured && <Badge icon={<Lock size={12} />}>Final</Badge>}</span>}
      actions={<>{super_ && <Button icon={<Pencil size={16} />} onClick={() => setEdit(true)}>Edit scheme</Button>}
        {super_ && s.status === 'open' && <Button variant="outline" icon={<Pause size={16} />} loading={busy} onClick={() => setStatus('close')}>Close to new investors</Button>}
        {super_ && s.status === 'closed' && s.remaining > 0 && <Button variant="outline" icon={<Play size={16} />} loading={busy} onClick={() => setStatus('reopen')}>Reopen</Button>}
        {s.status === 'draft' && isAdmin && (s.created_by !== me?.id || me?.role === 'super_admin') && <Button variant="secondary" icon={<CheckCircle2 size={16} />} loading={busy} onClick={() => run(() => api('POST', `/investments/${s.id}/approve`), 'Scheme is now open')}>Approve & open</Button>}
        {live && can('admin', 'accountant') && <Button variant="outline" icon={<Flag size={16} />} onClick={() => setMature(true)}>Declare maturity</Button>}</>} />
    {!super_ && <div className="mb-4"><Alert tone="info">Only the super admin can edit a scheme. You can review everything here.</Alert></div>}
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'overview', label: 'Overview' }, { key: 'investors', label: 'Investors', count: s.investors }, { key: 'returns', label: 'Returns' }, { key: 'history', label: 'History', count: s.edits.length }]} />

    <TabPanel id="overview" active={tab === 'overview'}><div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4"><StatCard label="Target" value={naira(s.target_amount, { compact: true })} hint={naira(s.target_amount)} /><StatCard label="Raised" tone="success" value={naira(s.raised, { compact: true })} hint={`${Math.round(s.progressPct)}% of target`} />
        <StatCard icon={<Users size={20} />} tone="info" label="Investors" value={s.investors} hint="Distinct subscriptions" /><StatCard label="Average investment" tone="warning" value={naira(s.averageTicket, { compact: true })} hint={s.investors ? `Largest ${naira(s.largestTicket, { compact: true })}` : 'No investors yet'} /></div>
      <div className="grid gap-5 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader title="Funding progress" subtitle={s.status === 'draft' ? 'Not yet open to members' : undefined} /><ProgressBar value={s.progressPct} label="Funding progress" tone={s.progressPct >= 100 ? 'success' : 'brand'} />
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm"><span><b className="num">{naira(s.raised)}</b> raised</span><span className="text-muted"><b className="num text-ink">{naira(s.remaining)}</b> remaining</span></div></Card>
        <Card><CardHeader title="Key terms" /><dl className="grid gap-2.5 text-sm">{[['Minimum investment', naira(s.min_amount)], ['Duration', `${s.duration_months} months`], ['Projected return', pct(roiNote)], [matured ? 'Matured on' : 'Expected maturity', date(matured ? s.matured_at : s.expectedMaturity)]].map(([k, v]) => <div key={k as string} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="num font-medium">{v}</dd></div>)}</dl></Card></div>
      <ChartCard title="Subscriptions by month" subtitle="Amount invested each month" height={220} empty={!s.byMonth.length} chart={{ kind: 'bars', data: s.byMonth.map((m: any) => ({ month: monthLabel(m.month), amount: m.amount })), x: 'month', series: [{ key: 'amount', label: 'Invested' }], money: true }} />
      <div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader title="Description" />{s.description ? <p className="whitespace-pre-line text-sm text-muted">{s.description}</p> : <p className="text-sm text-muted">No description yet.{super_ && ' Use Edit scheme to add one.'}</p>}</Card>
        <Card><CardHeader title="Ownership" /><dl className="grid gap-2.5 text-sm">{[['Created by', s.created_by_email ?? '—'], ['Created', dateTime(s.created_at)], ['Approved by', s.approved_by_email ?? '—'], ['Opened to members', s.opened_at ? dateTime(s.opened_at) : '—']].map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="min-w-0 truncate text-right font-medium">{v}</dd></div>)}</dl></Card></div></div></TabPanel>

    <TabPanel id="investors" active={tab === 'investors'}><TableCard><FilterBar actions={<Button size="sm" variant="outline" icon={<Download size={15} />} disabled={!s.subscribers.length} onClick={() => downloadText(`${s.title}-investors.csv`, toCsv(s.subscribers.map((x: any) => ({ Member: `${x.first_name} ${x.last_name}`, MembershipID: x.membership_id, Amount: x.amount, Payout: x.payout ?? '', Date: x.created_at }))))}>Export</Button>}>
      <SearchInput className="sm:w-72" value={q} onChange={setQ} placeholder="Search investor or ID" /></FilterBar>
      <DataTable rows={rows} rowKey={(x: any) => x.id} pageSize={10} caption="Investors" empty={<EmptyState icon={<Users size={22} />} title="No investors yet" description="Members who invest will be listed here." />}
        columns={[{ key: 'm', header: 'Investor', mobileTitle: true, sortBy: (x: any) => `${x.first_name} ${x.last_name}`, cell: (x: any) => <div><Link to={`/admin/members/${x.member_id}`} className="font-medium text-brand hover:underline">{x.first_name} {x.last_name}</Link><p className="text-xs text-muted">{x.membership_id}</p></div> },
          { key: 'a', header: 'Invested', align: 'right', sortBy: (x: any) => Number(x.amount), cell: (x: any) => <span className="num font-semibold">{naira(x.amount)}</span> }, { key: 'sh', header: 'Share', align: 'right', cell: (x: any) => <span className="num">{s.raised ? ((Number(x.amount) / s.raised) * 100).toFixed(1) : 0}%</span> },
          { key: 'd', header: 'Date', sortBy: (x: any) => x.created_at, cell: (x: any) => date(x.created_at) }, { key: 'p', header: 'Paid out', align: 'right', cell: (x: any) => (x.payout != null ? <span className="num">{naira(x.payout)}</span> : <span className="text-muted">—</span>) }]} /></TableCard></TabPanel>

    <TabPanel id="returns" active={tab === 'returns'}><div className="grid gap-5"><div className="grid gap-5 sm:grid-cols-2">
      <Card><div className="mb-2 flex items-center gap-2"><Badge tone="warning">Projected</Badge><span className="text-sm text-muted">At {pct(roiNote)}, not guaranteed</span></div><p className="num text-3xl font-bold">{naira(s.projectedPayout)}</p><p className="text-sm text-muted">expected total payout · profit {naira(s.projectedProfit)} on {naira(s.raised)}</p></Card>
      <Card><div className="mb-2 flex items-center gap-2"><Badge tone="success">Confirmed</Badge><span className="text-sm text-muted">Declared at maturity</span></div>{matured ? <><p className="num text-3xl font-bold">{naira(s.confirmedPayout)}</p><p className="text-sm text-muted">paid out · {s.confirmedProfit >= 0 ? 'profit' : 'loss'} {naira(Math.abs(s.confirmedProfit))} ({s.confirmedReturnPct}%)</p></> : <p className="text-muted">Nothing confirmed yet. Use Declare maturity when the scheme ends.</p>}</Card></div>
      {!matured && <Alert tone="info" title="How returns are settled">Declaring maturity pays every investor their amount plus the actual return you declare (negative for a loss) and closes the scheme permanently.</Alert>}
      <TableCard><DataTable rows={s.subscribers} rowKey={(x: any) => x.id} pageSize={8} caption="Per-investor returns" empty={<EmptyState title="No investors" />}
        columns={[{ key: 'm', header: 'Investor', mobileTitle: true, cell: (x: any) => <span className="font-medium">{x.first_name} {x.last_name}</span> }, { key: 'a', header: 'Invested', align: 'right', cell: (x: any) => <span className="num">{naira(x.amount)}</span> },
          { key: 'pr', header: 'Projected payout', align: 'right', cell: (x: any) => <span className="num text-muted">{naira(Number(x.amount) * (1 + roiNote / 100))}</span> }, { key: 'c', header: 'Confirmed payout', align: 'right', cell: (x: any) => (x.payout != null ? <span className="num font-semibold">{naira(x.payout)}</span> : '—') }]} /></TableCard></div></TabPanel>

    <TabPanel id="history" active={tab === 'history'}><div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-1"><CardHeader title="Lifecycle" /><ol className="grid gap-4">{timeline.map((t, i) => <li key={i} className="flex gap-3"><CircleDot size={18} className={`mt-0.5 shrink-0 ${(t as any).future ? 'text-muted' : 'text-success'}`} /><div><p className="font-medium">{t.t}</p><p className="text-sm text-muted">{dateTime(t.d)}{t.by ? ` · ${t.by}` : ''}{(t as any).future ? ' (estimated)' : ''}</p></div></li>)}</ol></Card>
      <Card className="lg:col-span-2"><CardHeader title="Change history" subtitle="Every edit, with before and after values" />{!s.edits.length ? <EmptyState title="No edits yet" description="Edits made by the super admin are recorded here." /> :
        <ul className="grid gap-5">{s.edits.map((e: any) => <li key={e.id} className="border-b border-line pb-5 last:border-0 last:pb-0"><div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"><b>{e.edited_by ?? 'Unknown'}</b><span className="text-muted">{dateTime(e.created_at)}</span></div>
          {e.reason && <p className="mb-2 rounded-lg bg-surface2 px-3 py-2 text-sm">“{e.reason}”</p>}<ul className="grid gap-1 text-sm">{Object.entries(e.changes).map(([k, v]: [string, any]) => <li key={k}><span className="text-muted">{FIELD[k] ?? k}:</span> {show(k, v.from)} <span className="text-muted">→</span> <b>{show(k, v.to)}</b></li>)}</ul></li>)}</ul>}</Card></div></TabPanel>

    {edit && <EditDrawer s={s} onClose={() => setEdit(false)} onSaved={d.reload} />}{mature && <MatureModal scheme={s} onClose={() => setMature(false)} onDone={d.reload} />}
  </>;
}
