import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowUpFromLine, Download, Plus, Target } from 'lucide-react';
import { Button, Card, CardHeader, ErrorState, PageSkeleton, ProgressBar, Alert } from '../../components/ui/primitives';
import { ChartCard, FinancialCard, PageHeader, StatCard, TransactionTable } from '../../components/ui/dashboard';
import { Modal, useAction, useConfirm } from '../../components/ui/overlay';
import { FormField, MoneyInput, Select, DatePicker } from '../../components/ui/forms';
import { FilterBar, TableCard } from '../../components/ui/data';
import PayModal from '../../components/features/PayModal';
import { api, invalidate, useApi } from '../../lib/api';
import { balanceSeries, contributionSeries, useMemberTxns } from '../../lib/data';
import { TXN_LABEL, date, naira } from '../../lib/format';
import { Sparkles, PiggyBank } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Savings() {
  const [sp, setSp] = useSearchParams(); const w = useApi<any>('/savings'); const tx = useMemberTxns(); const confirm = useConfirm();
  const [pay, setPay] = useState(sp.get('add') === '1'); const [wd, setWd] = useState(false); const [goal, setGoal] = useState(false);
  const [type, setType] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const ledger = useMemo(() => tx.rows.filter(r => r.affects_savings !== false), [tx.rows]);
  const filtered = useMemo(() => ledger.filter(r => (!type || r.type === type) && (!from || r.created_at.slice(0, 10) >= from) && (!to || r.created_at.slice(0, 10) <= to)), [ledger, type, from, to]);
  const bal = useMemo(() => balanceSeries(tx.rows, 12), [tx.rows]); const contrib = useMemo(() => contributionSeries(tx.rows, 6), [tx.rows]);
  const [runWd, busyWd] = useAction(() => { invalidate(); setWd(false); }); const [wAmt, setWAmt] = useState<number | ''>('');
  const [runGoal, busyGoal] = useAction(() => { invalidate(); setGoal(false); }); const [gAmt, setGAmt] = useState<number | ''>('');
  if (w.loading) return <PageSkeleton />;
  if (w.error || !w.data) return <ErrorState message={w.error?.message} onRetry={w.reload} />;
  const s = w.data; const thisMonth = new Date().toISOString().slice(0, 7);
  const monthTotal = ledger.filter(r => ['contribution', 'topup'].includes(r.type) && r.created_at.slice(0, 7) === thisMonth).reduce((a, r) => a + Number(r.amount), 0);
  const goalPct = s.monthlyTarget ? (monthTotal / s.monthlyTarget) * 100 : 0;
  const nextDue = (() => { const d = new Date(); d.setMonth(d.getMonth() + (monthTotal >= s.monthlyTarget ? 1 : 0), 1); return d; })();
  const close = () => { setPay(false); if (sp.get('add')) setSp({}, { replace: true }); tx.reload(); w.reload(); };
  const doWithdraw = async () => {
    if (typeof wAmt !== 'number' || wAmt < 100) return;
    const c = await confirm({ title: 'Confirm withdrawal', message: <>You are withdrawing <b className="text-ink">{naira(wAmt)}</b> from your savings. This cannot be undone.</>, confirmLabel: 'Withdraw', tone: 'danger' });
    if (c.ok) runWd(() => api('POST', '/savings/withdraw', { amount: wAmt }), 'Withdrawal recorded');
  };
  return <>
    <PageHeader title="Savings" description="Your wallet, contributions and history." actions={<><Button icon={<Plus size={16} />} onClick={() => setPay(true)}>Add money</Button><Button variant="outline" icon={<ArrowUpFromLine size={16} />} onClick={() => setWd(true)}>Withdraw</Button>
      <Link to="/statements"><Button variant="outline" icon={<Download size={16} />}>Statement</Button></Link></>} />
    <FinancialCard label="Current balance" total={naira(s.balance)} caption="Available balance"
      breakdown={[{ label: 'Available balance', value: naira(s.balance) }, { label: 'Pending deposits', value: naira(s.pendingDeposits), hint: 'Not yet in your balance' }, { label: 'Total balance', value: naira(s.balance + s.pendingDeposits), hint: 'Available + pending' }]} />
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><StatCard icon={<PiggyBank size={20} />} sensitive label="Total contributions" value={naira(s.totalContributions)} hint="Everything you have paid in" />
      <StatCard icon={<Sparkles size={20} />} tone="success" sensitive label="Investment returns" value={naira(s.returns)} hint="Confirmed payouts credited to savings" /></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-3"><Card className="h-fit lg:col-span-1"><CardHeader title="Monthly savings goal" action={<Button size="sm" variant="outline" icon={<Target size={15} />} onClick={() => { setGAmt(s.monthlyTarget || ''); setGoal(true); }}>{s.monthlyTarget ? 'Edit' : 'Set goal'}</Button>} />
      {s.monthlyTarget ? <><p className="num text-2xl font-bold">{naira(monthTotal)}<span className="text-base font-medium text-muted"> / {naira(s.monthlyTarget, { decimals: false })}</span></p>
        <div className="mt-3"><ProgressBar value={goalPct} label="Monthly contribution progress" tone={goalPct >= 100 ? 'success' : 'brand'} /></div>
        <p className="mt-3 text-sm text-muted">{goalPct >= 100 ? 'Goal reached this month. Well done!' : `${naira(s.monthlyTarget - monthTotal)} to go this month.`}</p>
        <div className="mt-4 rounded-xl bg-surface2 p-3 text-sm"><p className="text-muted">Next contribution due</p><p className="font-semibold">{date(nextDue)}</p></div></>
        : <p className="text-sm text-muted">Set a monthly goal to track your progress and see when your next contribution is due.</p>}</Card>
      <div className="lg:col-span-2"><ChartCard sensitive title="Balance over time" subtitle="Last 12 months" empty={!ledger.length} chart={{ kind: 'area', data: bal, x: 'month', series: [{ key: 'balance', label: 'Balance' }], money: true }} /></div></div>
    <div className="mt-5"><ChartCard sensitive title="Contributions" subtitle="Deposits per month, last 6 months" height={200} empty={!contrib.some(c => c.contributions)} chart={{ kind: 'bars', data: contrib, x: 'month', series: [{ key: 'contributions', label: 'Contributions' }], money: true }} /></div>
    <div className="mt-5"><TableCard><div className="px-5 pt-5"><h2 className="text-base font-semibold">Contribution history</h2></div>
      <FilterBar actions={(type || from || to) ? <Button size="sm" variant="ghost" onClick={() => { setType(''); setFrom(''); setTo(''); }}>Clear filters</Button> : undefined}>
        <div className="sm:w-52"><Select aria-label="Transaction type" value={type} onChange={e => setType(e.target.value)}><option value="">All types</option>{['topup', 'contribution', 'withdrawal', 'investment_subscription', 'investment_return'].map(t => <option key={t} value={t}>{TXN_LABEL[t]}</option>)}</Select></div>
        <div className="sm:w-44"><DatePicker aria-label="From date" value={from} onChange={e => setFrom(e.target.value)} /></div><div className="sm:w-44"><DatePicker aria-label="To date" value={to} onChange={e => setTo(e.target.value)} /></div></FilterBar>
      <TransactionTable rows={filtered} loading={tx.loading} /></TableCard></div>
    {pay && <PayModal purpose="topup" title="Add money" onClose={close} />}
    {wd && <Modal size="sm" title="Withdraw savings" onClose={() => setWd(false)} footer={<><Button variant="outline" onClick={() => setWd(false)}>Cancel</Button><Button loading={busyWd} disabled={typeof wAmt !== 'number' || wAmt < 100} onClick={doWithdraw}>Continue</Button></>}>
      <p className="mb-4 text-sm text-muted">Available to withdraw: <b className="num text-ink">{naira(s.balance)}</b></p><FormField label="Amount" required hint="10% of any active loan is held as security."><MoneyInput value={wAmt} onChange={setWAmt} autoFocus /></FormField></Modal>}
    {goal && <Modal size="sm" title="Monthly savings goal" onClose={() => setGoal(false)} footer={<><Button variant="outline" onClick={() => setGoal(false)}>Cancel</Button><Button loading={busyGoal} disabled={gAmt === ''} onClick={() => runGoal(() => api('PUT', '/savings/target', { monthlyTarget: gAmt }), 'Goal saved')}>Save goal</Button></>}>
      <FormField label="How much do you want to save each month?" hint="This is a personal target, not an automatic deduction."><MoneyInput value={gAmt} onChange={setGAmt} autoFocus /></FormField>
      <Alert tone="info">Automatic monthly deductions need a direct-debit mandate, which your cooperative office can set up.</Alert></Modal>}
  </>;
}
