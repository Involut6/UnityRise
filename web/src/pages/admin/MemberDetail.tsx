import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Avatar, Badge, Card, CardHeader, EmptyState, ErrorState, PageSkeleton, StatusBadge } from '../../components/ui/primitives';
import { PageHeader, StatCard, TransactionTable } from '../../components/ui/dashboard';
import { DataTable, Tabs, TabPanel, useTabParam } from '../../components/ui/data';
import KycReview from '../../components/features/KycReview';
import { DocViewer } from '../../components/features/DocViewer';
import { useApi } from '../../lib/api';
import { LOAN_LABEL, date, dateTime, naira } from '../../lib/format';
import { FileText, HandCoins, PiggyBank, TrendingUp } from 'lucide-react';

const KEYS = ['overview', 'kyc', 'savings', 'investments', 'loans', 'transactions', 'documents', 'activity', 'audit'];
const LABEL: Record<string, string> = { overview: 'Overview', kyc: 'KYC', savings: 'Savings', investments: 'Investments', loans: 'Loans', transactions: 'Transactions', documents: 'Documents', activity: 'Activity', audit: 'Audit trail' };
export default function MemberDetail() {
  const { id } = useParams(); const m = useApi<any>(`/members/${id}/full`); const [tab, setTab] = useTabParam('overview', KEYS);
  const activity = useMemo(() => { if (!m.data) return []; const d = m.data; return [...d.transactions.map((t: any) => ({ at: t.created_at, text: `${t.direction === 1 ? 'Credit' : 'Debit'} of ${naira(t.amount)} · ${t.narration ?? t.type}` })), ...d.loans.map((l: any) => ({ at: l.created_at, text: `Loan application: ${LOAN_LABEL[l.product_code]} ${naira(l.principal)} (${l.status.replace(/_/g, ' ')})` })), ...d.investments.map((i: any) => ({ at: i.created_at, text: `Invested ${naira(i.amount)} in ${i.title}` })), { at: d.created_at, text: 'Registered' }].sort((a, b) => +new Date(b.at) - +new Date(a.at)); }, [m.data]);
  if (m.loading) return <PageSkeleton />;
  if (m.error || !m.data) return <ErrorState message={m.error?.message ?? 'Member not found'} onRetry={m.reload} />;
  const d = m.data, name = `${d.first_name} ${d.last_name}`;
  return <>
    <PageHeader title={name} breadcrumbs={[{ label: 'Members', to: '/admin/members' }, { label: name }]} description={<span className="flex flex-wrap items-center gap-2"><span>{d.membership_id ?? 'No Membership ID yet'}</span><StatusBadge status={d.kyc_status} />{!d.is_active && <Badge tone="danger">Account disabled</Badge>}</span>} />
    <Tabs value={tab} onChange={setTab} tabs={KEYS.map(k => ({ key: k, label: LABEL[k]! }))} />
    <TabPanel id="overview" active={tab === 'overview'}><div className="grid gap-5 lg:grid-cols-3"><Card className="lg:col-span-1"><div className="flex items-center gap-3"><Avatar name={name} size={52} /><div><p className="text-lg font-semibold">{name}</p><p className="text-sm text-muted">{d.email}</p></div></div>
      <dl className="mt-5 grid gap-3 text-sm">{[['Phone', d.phone], ['Date of birth', date(d.date_of_birth)], ['Registered', date(d.created_at)], ['Address', d.address ?? '—']].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl></Card>
      <div className="grid content-start gap-4 sm:grid-cols-2 lg:col-span-2"><StatCard icon={<PiggyBank size={20} />} label="Savings balance" value={naira(d.savings)} /><StatCard icon={<TrendingUp size={20} />} tone="info" label="Investments" value={d.investments.length} hint={naira(d.investments.reduce((a: number, i: any) => a + Number(i.amount), 0))} />
        <StatCard icon={<HandCoins size={20} />} tone="warning" label="Loans" value={d.loans.length} hint={d.loans[0] ? `Latest: ${d.loans[0].status.replace(/_/g, ' ')}` : 'None'} /><StatCard icon={<FileText size={20} />} tone="success" label="Documents" value={d.documents.length} hint="KYC documents on file" /></div></div></TabPanel>
    <TabPanel id="kyc" active={tab === 'kyc'}><Card><KycReview m={{ ...d, reviewer: d.reviewer }} onDone={m.reload} /></Card></TabPanel>
    <TabPanel id="savings" active={tab === 'savings'}><div className="grid gap-5"><StatCard icon={<PiggyBank size={20} />} label="Current savings balance" value={naira(d.savings)} /><Card padded={false} className="overflow-hidden"><TransactionTable rows={d.transactions.filter((t: any) => ['topup', 'contribution', 'withdrawal', 'investment_subscription', 'investment_return'].includes(t.type)).map((t: any) => ({ ...t, status: 'success' }))} /></Card></div></TabPanel>
    <TabPanel id="investments" active={tab === 'investments'}><Card padded={false}><DataTable rows={(d.investments as any[]).map((i, n) => ({ ...i, k: String(n) }))} rowKey={r => r.k} caption="Investments" empty={<EmptyState title="No investments" />}
      columns={[{ key: 't', header: 'Scheme', mobileTitle: true, cell: r => <span className="font-medium">{r.title}</span> }, { key: 'a', header: 'Invested', cell: r => <span className="num">{naira(r.amount)}</span> }, { key: 'p', header: 'Paid out', cell: r => (r.payout != null ? <span className="num">{naira(r.payout)}</span> : '—') }, { key: 's', header: 'Status', cell: r => <StatusBadge status={r.status} /> }, { key: 'd', header: 'Date', cell: r => date(r.created_at) }]} /></Card></TabPanel>
    <TabPanel id="loans" active={tab === 'loans'}><Card padded={false}><DataTable rows={d.loans as any[]} rowKey={r => r.id} caption="Loans" empty={<EmptyState title="No loans" />}
      columns={[{ key: 'p', header: 'Loan', mobileTitle: true, cell: r => <Link className="font-medium text-brand hover:underline" to={`/admin/loans?open=${r.id}`}>{LOAN_LABEL[r.product_code]}</Link> }, { key: 'a', header: 'Amount', cell: r => <span className="num">{naira(r.principal)}</span> }, { key: 't', header: 'Tenor', cell: r => `${r.tenor_months} mo` }, { key: 's', header: 'Status', cell: r => <StatusBadge status={r.status} /> }, { key: 'd', header: 'Applied', cell: r => date(r.created_at) }]} /></Card></TabPanel>
    <TabPanel id="transactions" active={tab === 'transactions'}><Card padded={false} className="overflow-hidden"><TransactionTable rows={d.transactions.map((t: any) => ({ ...t, status: 'success' }))} /></Card></TabPanel>
    <TabPanel id="documents" active={tab === 'documents'}><Card>{d.documents.length ? <ul className="divide-y divide-line">{d.documents.map((x: any) => <li key={x.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"><FileText size={20} className="text-muted" /><div className="min-w-0 flex-1"><p className="font-medium capitalize">{x.kind.replace(/_/g, ' ')}</p><p className="truncate text-xs text-muted">{x.filename} · {date(x.created_at)}</p></div><DocViewer path={`/members/${d.id}/documents/${x.id}/file`} name={x.filename} /></li>)}</ul> : <EmptyState title="No documents" />}</Card></TabPanel>
    <TabPanel id="activity" active={tab === 'activity'}><Card><ol className="relative ml-2 grid gap-5 border-l border-line pl-5">{activity.slice(0, 40).map((a, i) => <li key={i} className="relative"><span className="absolute -left-[26px] top-1.5 size-2.5 rounded-full bg-brand" aria-hidden /><p className="text-sm font-medium">{a.text}</p><p className="text-xs text-muted">{dateTime(a.at)}</p></li>)}</ol></Card></TabPanel>
    <TabPanel id="audit" active={tab === 'audit'}><Card padded={false}><DataTable rows={d.audit as any[]} rowKey={r => String(r.id)} caption="Audit trail" empty={<EmptyState title="No audit entries" description="Administrative actions on this member are recorded here." />}
      columns={[{ key: 'a', header: 'Action', mobileTitle: true, cell: r => <span className="font-mono text-xs">{r.action}</span> }, { key: 'u', header: 'By', cell: r => r.actor ?? 'system' }, { key: 't', header: 'When', cell: r => dateTime(r.created_at) }]} /></Card></TabPanel>
  </>;
}
