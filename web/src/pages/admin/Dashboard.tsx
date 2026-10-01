import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Banknote, HandCoins, PiggyBank, Percent, ShieldCheck, TrendingUp, UserCheck, Users } from 'lucide-react';
import { Card, CardHeader, ErrorState, PageSkeleton, ProgressBar } from '../../components/ui/primitives';
import { ChartCard, PageHeader, StatCard, TransactionTable } from '../../components/ui/dashboard';
import { useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { LOAN_LABEL, monthLabel, naira, pct } from '../../lib/format';

export default function AdminDashboard() {
  const ov = useApi<any>('/admin/overview'); const nav = useNavigate(); const { can } = useAuth();
  const series = useMemo(() => (ov.data?.series ?? []).map((s: any) => ({ month: monthLabel(s.month), savingsIn: Number(s.savings_in), loansOut: Number(s.loans_out), newMembers: Number(s.new_members) })), [ov.data]);
  if (ov.loading) return <PageSkeleton />;
  if (ov.error || !ov.data) return <ErrorState message={ov.error?.message} onRetry={ov.reload} />;
  const o = ov.data;
  return <>
    <PageHeader title="Dashboard" description="Operational overview of the cooperative." />
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatCard icon={<Users size={20} />} label="Total members" value={o.totalMembers} hint={`${o.activeMembers} verified`} to="/admin/members" />
      <StatCard icon={<UserCheck size={20} />} tone="success" label="Active members" value={o.activeMembers} hint="Verified and active" />
      <StatCard icon={<PiggyBank size={20} />} label="Total savings" value={naira(o.totalSavings, { compact: true })} hint={naira(o.totalSavings)} />
      <StatCard icon={<TrendingUp size={20} />} tone="info" label="Total investments" value={naira(o.totalInvestments, { compact: true })} hint="In live schemes" />
      <StatCard icon={<HandCoins size={20} />} label="Active loans" value={o.activeLoans} to="/admin/loans" />
      <StatCard icon={<Banknote size={20} />} tone="warning" label="Outstanding loans" value={naira(o.outstandingLoans, { compact: true })} hint={naira(o.outstandingLoans)} />
      <StatCard icon={<ShieldCheck size={20} />} tone={o.pendingKyc ? 'warning' : 'success'} label="Pending KYC" value={o.pendingKyc} hint={o.pendingKyc ? 'Needs review' : 'Nothing waiting'} to={can('admin') ? '/admin/kyc' : undefined} />
      <StatCard icon={<HandCoins size={20} />} tone={o.pendingLoans ? 'warning' : 'success'} label="Pending loan applications" value={o.pendingLoans} hint={o.pendingLoans ? 'Awaiting approval' : 'Nothing waiting'} to="/admin/loans?status=under_review" /></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2"><ChartCard title="Money in vs loans out" subtitle="Last 6 months" empty={!series.some((s: any) => s.savingsIn || s.loansOut)} chart={{ kind: 'bars', data: series, x: 'month', money: true, series: [{ key: 'savingsIn', label: 'Savings in' }, { key: 'loansOut', label: 'Loans disbursed', color: 'var(--c-accent)' }] }} /></div>
      <Card><CardHeader title="Repayment rate" subtitle="Paid vs due to date, active loans" /><p className="num text-4xl font-bold">{pct(o.repaymentRate)}</p><div className="mt-3"><ProgressBar value={o.repaymentRate} tone={o.repaymentRate >= 90 ? 'success' : o.repaymentRate >= 70 ? 'warning' : 'brand'} label="Repayment rate" /></div>
        <p className="mt-3 text-sm text-muted">{o.repaymentRate >= 90 ? 'Healthy: borrowers are paying on time.' : 'Below target. Review overdue loans.'}</p></Card></div>
    <div className="mt-5 grid gap-5 lg:grid-cols-3"><div className="lg:col-span-2"><ChartCard title="New members" subtitle="Approved per month" height={200} empty={!series.some((s: any) => s.newMembers)} chart={{ kind: 'area', data: series, x: 'month', series: [{ key: 'newMembers', label: 'New members' }] }} /></div>
      <ChartCard title="Loan book by type" subtitle="Active and completed loans" height={200} empty={!o.byProduct.length} chart={{ kind: 'donut', data: o.byProduct.map((p: any) => ({ name: LOAN_LABEL[p.name] ?? p.name, value: p.value })) }} /></div>
    <Card padded={false} className="mt-5 overflow-hidden"><div className="p-5 pb-0"><CardHeader title="Recent transactions" action={can('admin', 'accountant') ? <Link to="/admin/transactions" className="text-sm font-semibold text-brand hover:underline">View all</Link> : undefined} /></div>
      <TransactionTable compact showMember pageSize={8} rows={o.recent.map((r: any) => ({ ...r, status: 'success' }))} /></Card>
  </>;
}
export { Percent };
