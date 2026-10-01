import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Download, HandCoins, PiggyBank, Plus, ReceiptText, TrendingUp, Wallet, Megaphone, CalendarClock, Sparkles } from 'lucide-react';
import { Button, Card, CardHeader, EmptyState, ErrorState, PageSkeleton, ProgressBar, StatusBadge } from '../../components/ui/primitives';
import { ChartCard, FinancialCard, PageHeader, StatCard, TransactionTable } from '../../components/ui/dashboard';
import PayModal from '../../components/features/PayModal';
import { useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { balanceSeries, contributionSeries, useMemberTxns } from '../../lib/data';
import { CATEGORY_LABEL, LOAN_LABEL, date, greeting, naira } from '../../lib/format';

export default function Dashboard() {
  const { me } = useAuth(); const nav = useNavigate(); const [pay, setPay] = useState(false);
  const d = useApi<any>('/dashboard'); const w = useApi<any>('/savings'); const ann = useApi<any[]>('/announcements'); const tx = useMemberTxns();
  const loans = useApi<any[]>('/loans/mine'); const pf = useApi<any[]>('/investments/portfolio');
  const active = loans.data?.find(l => l.status === 'active'); const sched = useApi<any[]>(active ? `/loans/${active.id}/schedule` : null);
  const bal = useMemo(() => balanceSeries(tx.rows), [tx.rows]); const contrib = useMemo(() => contributionSeries(tx.rows), [tx.rows]);
  const loanProgress = useMemo(() => { const s = sched.data; if (!s?.length) return null; const total = s.reduce((a, r) => a + Number(r.principal_due) + Number(r.interest_due) + Number(r.penalty), 0); const paid = s.reduce((a, r) => a + Number(r.paid), 0); return { pct: total ? (paid / total) * 100 : 0, paid, total, next: s.find(r => Number(r.paid) < Number(r.principal_due) + Number(r.interest_due) + Number(r.penalty)) }; }, [sched.data]);
  if (d.loading || w.loading) return <PageSkeleton />;
  if (d.error || !d.data) return <ErrorState message={d.error?.message} onRetry={d.reload} />;
  const x = d.data, wallet = w.data ?? { balance: x.savings, pendingDeposits: 0, totalContributions: 0, returns: 0 };
  const quick = [[Plus, 'Add savings', () => setPay(true)], [HandCoins, 'Apply for loan', () => nav('/loans/apply')], [TrendingUp, 'Make investment', () => nav('/investments')], [ReceiptText, 'Transactions', () => nav('/transactions')], [Download, 'Statement', () => nav('/statements')]] as const;
  return <>
    <PageHeader title={`${greeting()}, ${me?.first_name ?? 'there'}`} description={<>Membership ID <b className="text-ink">{me?.membership_id}</b> · {new Date().toLocaleDateString('en-NG', { dateStyle: 'full' })}</>} />
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2"><FinancialCard label="Total savings balance" total={naira(wallet.balance)} caption="Available to use now"
        breakdown={[{ label: 'Available', value: naira(wallet.balance) }, { label: 'Pending deposits', value: naira(wallet.pendingDeposits), hint: 'Awaiting confirmation' }, { label: 'Total contributions', value: naira(wallet.totalContributions), hint: 'All time' }]}
        actions={<><Button variant="outline" className="border-white/30 bg-white text-brand hover:bg-white/90" icon={<Plus size={16} />} onClick={() => setPay(true)}>Add savings</Button>
          <Button variant="ghost" className="text-on-brand hover:bg-white/15" onClick={() => nav('/savings')} icon={<ArrowRight size={16} />}>View wallet</Button></>} /></div>
      <Card className="flex flex-col"><CardHeader title="Outstanding obligations" />
        {active ? <div className="flex flex-1 flex-col"><p className="text-sm text-muted">Loan balance · {LOAN_LABEL[active.product_code]}</p><p className="num text-2xl font-bold">{naira(x.loanOutstanding)}</p>
          {loanProgress && <div className="mt-3"><div className="mb-1.5 flex justify-between text-xs text-muted"><span>Repaid</span><span className="num">{Math.round(loanProgress.pct)}%</span></div><ProgressBar value={loanProgress.pct} label="Loan repayment progress" tone="success" /></div>}
          {loanProgress?.next && <div className="mt-4 flex items-center gap-3 rounded-xl bg-surface2 p-3"><CalendarClock size={20} className="text-muted" aria-hidden /><div className="text-sm"><p className="text-muted">Next repayment</p><p className="font-semibold"><span className="num">{naira(Number(loanProgress.next.principal_due) + Number(loanProgress.next.interest_due) + Number(loanProgress.next.penalty) - Number(loanProgress.next.paid))}</span> · {date(loanProgress.next.due_date)}</p></div></div>}
          <Link to="/loans" className="mt-auto pt-4 text-sm font-semibold text-brand hover:underline">Manage loan →</Link></div>
          : <EmptyState icon={<HandCoins size={22} />} title="No active loan" description="You have no outstanding loan." action={<Button size="sm" variant="secondary" onClick={() => nav('/loans/apply')}>Apply for a loan</Button>} />}</Card></div>

    <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatCard icon={<TrendingUp size={20} />} label="Investment portfolio" value={naira(x.invested)} hint="Amount invested in live schemes" to="/investments" />
      <StatCard icon={<Sparkles size={20} />} tone="success" label="Returns earned" value={naira(x.returnsEarned)} hint="Confirmed, paid to savings" />
      <StatCard icon={<Wallet size={20} />} tone="info" label="Monthly savings goal" value={wallet.monthlyTarget ? naira(wallet.monthlyTarget, { decimals: false }) : 'Not set'} hint={wallet.monthlyTarget ? 'Set on the Savings page' : 'Set one on the Savings page'} to="/savings" />
      <StatCard icon={<Megaphone size={20} />} tone="warning" label="Unread notifications" value={x.unread} hint={x.unread ? 'Tap to read' : 'All caught up'} to="/notifications" /></div>

    <nav aria-label="Quick actions" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{quick.map(([I, l, fn]) => <button key={l} onClick={fn} className="max-sm:last:col-span-2 flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface p-4 text-sm font-semibold shadow-card transition hover:border-brand hover:text-brand">
      <span className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand"><I size={20} aria-hidden /></span>{l}</button>)}</nav>

    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <ChartCard title="Savings growth" subtitle="Month-end balance, last 6 months" empty={!tx.rows.some(r => r.affects_savings !== false)} chart={{ kind: 'area', data: bal, x: 'month', series: [{ key: 'balance', label: 'Balance' }], money: true }} />
      <ChartCard title="Contribution history" subtitle="Deposits per month" empty={!contrib.some(c => c.contributions)} chart={{ kind: 'bars', data: contrib, x: 'month', series: [{ key: 'contributions', label: 'Contributions' }], money: true }} /></div>

    <div className="mt-5 grid gap-5 lg:grid-cols-3">
      <Card padded={false} className="overflow-hidden lg:col-span-2"><div className="p-5 pb-0"><CardHeader title="Recent transactions" action={<Link to="/transactions" className="text-sm font-semibold text-brand hover:underline">View all</Link>} /></div>
        <TransactionTable compact rows={tx.rows.slice(0, 5)} loading={tx.loading} pageSize={5} /></Card>
      <div className="grid content-start gap-5">
        <Card><CardHeader title="Upcoming payments" />{x.upcoming.length ? <ul className="divide-y divide-line">{x.upcoming.map((u: any) => <li key={u.installment_no} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"><div><p className="font-medium">Instalment {u.installment_no}</p><p className="text-sm text-muted">Due {date(u.due_date)}</p></div><span className="num font-semibold">{naira(u.amount)}</span></li>)}</ul> : <p className="text-sm text-muted">No payments due.</p>}</Card>
        <Card><CardHeader title="Investments" />{pf.data?.length ? <ul className="divide-y divide-line">{pf.data.slice(0, 3).map(p => <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"><div className="min-w-0"><p className="truncate font-medium">{p.title}</p><p className="text-xs text-muted">{CATEGORY_LABEL[p.category]}</p></div><div className="text-right"><p className="num font-semibold">{naira(p.amount)}</p><StatusBadge status={p.status} /></div></li>)}</ul> : <p className="text-sm text-muted">You have not invested yet.</p>}</Card>
        {!!ann.data?.length && <Card><CardHeader title="Announcements" /><ul className="grid gap-3">{ann.data.slice(0, 2).map(a => <li key={a.id}><p className="font-semibold">{a.title}</p><p className="line-clamp-2 text-sm text-muted">{a.body}</p></li>)}</ul></Card>}</div></div>
    {pay && <PayModal purpose="topup" title="Add savings" onClose={() => { setPay(false); tx.reload(); w.reload(); d.reload(); }} />}
  </>;
}
export { PiggyBank };
