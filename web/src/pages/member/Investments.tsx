import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Layers, PieChart, TrendingUp } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, PageSkeleton, ProgressBar, StatusBadge } from '../../components/ui/primitives';
import { PageHeader, StatCard } from '../../components/ui/dashboard';
import InvestModal from '../../components/features/InvestModal';
import { useApi } from '../../lib/api';
import { CATEGORY_LABEL, date, naira, pct } from '../../lib/format';

export const maturity = (s: any) => { const d = new Date(s.matured_at ?? s.opened_at ?? s.created_at); if (!s.matured_at) d.setMonth(d.getMonth() + Number(s.duration_months)); return d; };
export const RISK_TONE = { low: 'success', medium: 'warning', high: 'danger' } as const;

export default function Investments() {
  const list = useApi<any[]>('/investments'); const pf = useApi<any[]>('/investments/portfolio'); const [cat, setCat] = useState(''); const [status, setStatus] = useState('open'); const [inv, setInv] = useState<any>(null);
  const shown = useMemo(() => (list.data ?? []).filter(s => (!cat || s.category === cat) && (!status || s.status === status)), [list.data, cat, status]);
  const summary = useMemo(() => { const p = pf.data ?? []; const live = p.filter(x => x.status !== 'matured'); return { invested: live.reduce((a, x) => a + Number(x.amount), 0), projected: live.reduce((a, x) => a + Number(x.amount) * (1 + Number(x.projected_roi_pct) / 100), 0), confirmed: p.reduce((a, x) => a + Number(x.payout ?? 0), 0), count: p.length }; }, [pf.data]);
  if (list.loading) return <PageSkeleton />;
  if (list.error) return <ErrorState message={list.error.message} onRetry={list.reload} />;
  const chip = (on: boolean) => `h-9 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap ${on ? 'border-brand bg-brand-soft text-brand' : 'border-line-strong hover:bg-surface2'}`;
  return <>
    <PageHeader title="Investments" description="Cooperative schemes you can invest in from your savings." />
    <div className="grid gap-4 sm:grid-cols-3"><StatCard icon={<Layers size={20} />} label="Currently invested" value={naira(summary.invested)} hint={`${summary.count} investment${summary.count === 1 ? '' : 's'} in total`} />
      <StatCard icon={<PieChart size={20} />} tone="info" label="Projected value" value={naira(summary.projected)} hint="Estimate at projected returns, not guaranteed" />
      <StatCard icon={<TrendingUp size={20} />} tone="success" label="Confirmed payouts" value={naira(summary.confirmed)} hint="Actually paid out at maturity" /></div>
    <div className="mb-5 mt-6 grid gap-3"><div className="flex flex-wrap gap-2" role="group" aria-label="Status">{[['open', 'Open'], ['closed', 'Fully subscribed'], ['matured', 'Matured'], ['', 'All']].map(([k, l]) => <button key={k} onClick={() => setStatus(k!)} aria-pressed={status === k} className={chip(status === k)}>{l}</button>)}</div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Category"><button onClick={() => setCat('')} aria-pressed={!cat} className={chip(!cat)}>All types</button>{Object.entries(CATEGORY_LABEL).map(([k, l]) => <button key={k} onClick={() => setCat(k)} aria-pressed={cat === k} className={chip(cat === k)}>{l}</button>)}</div></div>
    {!shown.length ? <Card><EmptyState icon={<TrendingUp size={22} />} title="No schemes match" description="There are no investment schemes in this view right now." /></Card> :
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{shown.map(s => { const prog = (Number(s.raised) / Number(s.target_amount)) * 100; return <Card key={s.id} className="flex flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-2"><Badge tone="brand">{CATEGORY_LABEL[s.category]}</Badge><Badge tone={RISK_TONE[s.risk_profile as keyof typeof RISK_TONE]}>{s.risk_profile} risk</Badge><span className="ml-auto"><StatusBadge status={s.status} /></span></div>
        <h3 className="text-lg font-semibold leading-snug"><Link to={`/investments/${s.id}`} className="hover:underline">{s.title}</Link></h3>
        <div className="mt-3 flex items-end justify-between"><div><p className="text-xs text-muted">Projected return</p><p className="num text-2xl font-bold text-brand">{pct(s.projected_roi_pct)}</p></div><div className="text-right"><p className="text-xs text-muted">Duration</p><p className="num font-semibold">{s.duration_months} months</p></div></div>
        <div className="mt-4"><div className="mb-1.5 flex justify-between text-sm"><span className="num font-semibold">{naira(s.raised, { compact: true })}</span><span className="text-muted">of {naira(s.target_amount, { compact: true })}</span></div><ProgressBar value={prog} label={`${s.title} funding progress`} /></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted">Minimum</dt><dd className="num font-medium">{naira(s.min_amount, { decimals: false })}</dd></div><div><dt className="text-xs text-muted">{s.status === 'matured' ? 'Matured' : 'Expected maturity'}</dt><dd className="flex items-center gap-1 font-medium"><Clock size={13} className="text-muted" />{date(maturity(s))}</dd></div></dl>
        <div className="mt-auto flex gap-2 pt-5"><Link to={`/investments/${s.id}`} className="flex-1"><Button variant="outline" block>Details</Button></Link>{s.status === 'open' && <Button className="flex-1" onClick={() => setInv(s)}>Invest</Button>}</div></Card>; })}</div>}
    {!!pf.data?.length && <Card className="mt-6"><h2 className="mb-3 text-base font-semibold">My investments</h2><ul className="divide-y divide-line">{pf.data.map(p => <li key={p.id}><Link to={`/investments/${p.scheme_id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80"><div className="min-w-0"><p className="truncate font-medium">{p.title}</p><p className="text-sm text-muted">{date(p.created_at)} · {CATEGORY_LABEL[p.category]}</p></div>
      <div className="text-right"><p className="num font-semibold">{naira(p.amount)}</p><StatusBadge status={p.status} /></div></Link></li>)}</ul></Card>}
    {inv && <InvestModal scheme={inv} onClose={() => { setInv(null); list.reload(); pf.reload(); }} />}
  </>;
}
