import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Circle, FileText, Info } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, ErrorState, PageSkeleton, ProgressBar, StatusBadge } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { Tabs, TabPanel, useTabParam } from '../../components/ui/data';
import InvestModal from '../../components/features/InvestModal';
import { useApi } from '../../lib/api';
import { CATEGORY_LABEL, date, dateTime, naira, pct } from '../../lib/format';
import { RISK_TONE } from './Investments';

const KEYS = ['overview', 'details', 'progress', 'returns', 'timeline', 'documents', 'history'];
export default function InvestmentDetail() {
  const { id } = useParams(); const s = useApi<any>(`/investments/${id}`); const [tab, setTab] = useTabParam('overview', KEYS); const [inv, setInv] = useState(false);
  if (s.loading) return <PageSkeleton />;
  if (s.error || !s.data) return <ErrorState message={s.error?.message ?? 'Investment not found'} onRetry={s.reload} />;
  const x = s.data, prog = (Number(x.raised) / Number(x.target_amount)) * 100, mine: any[] = x.mine ?? [], myTotal = mine.reduce((a, m) => a + Number(m.amount), 0);
  const matured = x.status === 'matured', projected = myTotal * (1 + Number(x.projected_roi_pct) / 100), confirmed = mine.reduce((a, m) => a + Number(m.payout ?? 0), 0);
  const timeline = [{ t: 'Scheme created', d: x.created_at, done: true }, { t: 'Opened for subscriptions', d: x.opened_at, done: !!x.opened_at }, { t: 'Fully subscribed', d: null, done: x.status === 'closed' || matured },
    { t: matured ? 'Matured and paid out' : 'Expected maturity', d: matured ? x.matured_at : x.expectedMaturity, done: matured }];
  return <>
    <PageHeader title={x.title} breadcrumbs={[{ label: 'Investments', to: '/investments' }, { label: x.title }]} description={<span className="flex flex-wrap items-center gap-2"><Badge tone="brand">{CATEGORY_LABEL[x.category]}</Badge><Badge tone={RISK_TONE[x.risk_profile as keyof typeof RISK_TONE]}>{x.risk_profile} risk</Badge><StatusBadge status={x.status} /></span>}
      actions={x.status === 'open' ? <Button onClick={() => setInv(true)}>Invest now</Button> : undefined} />
    <Tabs value={tab} onChange={setTab} tabs={KEYS.map(k => ({ key: k, label: k[0]!.toUpperCase() + k.slice(1) }))} />
    <TabPanel id="overview" active={tab === 'overview'}><div className="grid gap-5 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader title="At a glance" />
      <dl className="grid grid-cols-2 gap-5 sm:grid-cols-4">{[['Target', naira(x.target_amount, { compact: true })], ['Raised', naira(x.raised, { compact: true })], ['Projected return', pct(x.projected_roi_pct)], ['Duration', `${x.duration_months} months`]].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="num text-xl font-bold">{v}</dd></div>)}</dl>
      <div className="mt-5"><div className="mb-1.5 flex justify-between text-sm"><span className="text-muted">Funding progress</span><span className="num font-semibold">{Math.round(prog)}%</span></div><ProgressBar value={prog} label="Funding progress" /></div>
      {x.description && <p className="mt-5 whitespace-pre-line text-sm text-muted">{x.description}</p>}</Card>
      <Card><CardHeader title="Your position" />{myTotal ? <dl className="grid gap-3"><div><dt className="text-xs text-muted">You invested</dt><dd className="num text-xl font-bold">{naira(myTotal)}</dd></div>
        <div><dt className="flex items-center gap-1.5 text-xs text-muted">{matured ? 'Confirmed payout' : 'Projected value'}<Badge tone={matured ? 'success' : 'warning'}>{matured ? 'Confirmed' : 'Projected'}</Badge></dt><dd className="num text-xl font-bold">{naira(matured ? confirmed : projected)}</dd></div></dl>
        : <p className="text-sm text-muted">You have not invested in this scheme.</p>}</Card></div></TabPanel>
    <TabPanel id="details" active={tab === 'details'}><Card><dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{[['Category', CATEGORY_LABEL[x.category]], ['Risk profile', x.risk_profile], ['Minimum investment', naira(x.min_amount)], ['Target amount', naira(x.target_amount)], ['Duration', `${x.duration_months} months`], ['Subscribers', x.subscribers], ['Status', <StatusBadge status={x.status} />]].map(([k, v], i) => <div key={i} className="flex justify-between gap-3 border-b border-line pb-3"><dt className="text-muted">{k}</dt><dd className="font-medium capitalize">{v}</dd></div>)}</dl></Card></TabPanel>
    <TabPanel id="progress" active={tab === 'progress'}><Card><CardHeader title="Funding progress" /><p className="num text-3xl font-bold">{naira(x.raised)}</p><p className="mb-3 text-muted">raised of {naira(x.target_amount)} target · {x.subscribers} investor{Number(x.subscribers) === 1 ? '' : 's'}</p><ProgressBar value={prog} label="Funding" /><p className="mt-3 text-sm text-muted">{naira(Number(x.target_amount) - Number(x.raised))} remaining</p></Card></TabPanel>
    <TabPanel id="returns" active={tab === 'returns'}><div className="grid gap-5 sm:grid-cols-2"><Card><div className="mb-2 flex items-center gap-2"><Badge tone="warning">Projected</Badge><span className="text-sm text-muted">Estimate, not guaranteed</span></div><p className="num text-3xl font-bold">{myTotal ? naira(projected - myTotal) : pct(x.projected_roi_pct)}</p><p className="text-sm text-muted">{myTotal ? `expected profit on your ${naira(myTotal)}` : 'projected return rate for this scheme'}</p></Card>
      <Card><div className="mb-2 flex items-center gap-2"><Badge tone="success">Confirmed</Badge><span className="text-sm text-muted">Declared by management</span></div>{matured ? <><p className="num text-3xl font-bold">{naira(confirmed)}</p><p className="text-sm text-muted">paid to your savings at maturity</p></> : <p className="text-muted">Nothing confirmed yet. Returns are confirmed when the scheme matures.</p>}</Card>
      <div className="sm:col-span-2"><Alert tone="info" title="How returns work">Projected figures are estimates set when the scheme was created. The actual return, which can be higher, lower or even a loss, is declared at maturity and paid into your savings.</Alert></div></div></TabPanel>
    <TabPanel id="timeline" active={tab === 'timeline'}><Card><ol className="grid gap-5">{timeline.map((t, i) => <li key={i} className="flex gap-3">{t.done ? <CheckCircle2 className="mt-0.5 text-success" size={20} /> : <Circle className="mt-0.5 text-muted" size={20} />}<div><p className="font-semibold">{t.t}</p><p className="text-sm text-muted">{t.d ? date(t.d) + (!t.done ? ' (estimated)' : '') : t.done ? 'Completed' : 'Pending'}</p></div></li>)}</ol></Card></TabPanel>
    <TabPanel id="documents" active={tab === 'documents'}><Card><EmptyState icon={<FileText size={22} />} title="No documents published" description="Offer documents and reports for this scheme will appear here when management uploads them." /></Card></TabPanel>
    <TabPanel id="history" active={tab === 'history'}><Card padded={false}>{mine.length ? <ul className="divide-y divide-line">{mine.map(m => <li key={m.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-medium">Subscription</p><p className="text-sm text-muted">{dateTime(m.created_at)}</p></div><div className="text-right"><p className="num font-semibold">{naira(m.amount)}</p>{m.payout != null && <p className="text-xs text-success">Paid out {naira(m.payout)}</p>}</div></li>)}</ul> : <EmptyState icon={<Info size={22} />} title="No investment history" description="Your subscriptions to this scheme will be listed here." />}</Card></TabPanel>
    {inv && <InvestModal scheme={x} onClose={() => { setInv(false); s.reload(); }} />}
  </>;
}
