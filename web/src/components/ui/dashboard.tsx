import { ReactNode, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownLeft, ArrowUpRight, ChevronRight } from 'lucide-react';
import { Breadcrumbs, DataTable, type Column } from './data';
import { Card, CardHeader, EmptyState, Money, Skeleton, StatusBadge, cn } from './primitives';
import { date, naira, TXN_LABEL } from '../../lib/format';

export const PageHeader = ({ title, description, breadcrumbs, actions }: { title: string; description?: ReactNode; breadcrumbs?: { label: string; to?: string }[]; actions?: ReactNode }) => (
  <div className="mb-6">{breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><h1 className="text-2xl font-bold tracking-tight">{title}</h1>{description && <p className="mt-1 text-muted">{description}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div></div>
);

export function StatCard({ label, value, hint, icon, to, tone = 'brand' }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; to?: string; tone?: 'brand' | 'warning' | 'info' | 'danger' | 'success' }) {
  const toneCls = { brand: 'bg-brand-soft text-brand', warning: 'bg-warning-soft text-warning', info: 'bg-info-soft text-info', danger: 'bg-danger-soft text-danger', success: 'bg-success-soft text-success' }[tone];
  const body = <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:gap-3.5">{icon && <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', toneCls)} aria-hidden>{icon}</span>}
    <div className="min-w-0"><p className="text-sm text-muted">{label}</p><p className="num mt-0.5 truncate text-xl font-bold sm:text-2xl">{value}</p>{hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}</div>
    {to && <ChevronRight size={18} className="ml-auto mt-1 hidden shrink-0 text-muted sm:block" aria-hidden />}</div>;
  return to ? <Link to={to} className="block rounded-2xl border border-line bg-surface p-5 shadow-card transition max-sm:p-4 hover:border-line-strong hover:shadow-md">{body}</Link> : <Card className="max-sm:p-4">{body}</Card>;
}

/** The headline balance card. Breakdown labels say exactly what each figure is. */
export function FinancialCard({ label, total, caption, breakdown, actions }: { label: string; total: string; caption?: string; breakdown: { label: string; value: string; hint?: string }[]; actions?: ReactNode }) {
  return <section className="rounded-2xl bg-brand p-5 text-on-brand shadow-card sm:p-6" aria-label={label}>
    <p className="text-sm font-medium opacity-80">{label}</p><p className="num mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{total}</p>{caption && <p className="mt-1 text-sm opacity-75">{caption}</p>}
    <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-white/20 pt-4 sm:grid-cols-3">{breakdown.map(b => <div key={b.label}><dt className="text-xs font-medium opacity-75">{b.label}</dt><dd className="num font-semibold">{b.value}</dd>{b.hint && <dd className="text-xs opacity-65">{b.hint}</dd>}</div>)}</dl>
    {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}</section>;
}

const Charts = lazy(() => import('./charts'));
export function ChartCard({ title, subtitle, action, height = 240, empty, chart }: { title: string; subtitle?: string; action?: ReactNode; height?: number; empty?: boolean; chart: React.ComponentProps<typeof Charts> }) {
  return <Card><CardHeader title={title} subtitle={subtitle} action={action} />
    {empty ? <EmptyState title="Not enough data yet" description="This chart fills in as activity is recorded." /> :
      <Suspense fallback={<Skeleton className="w-full" />}><div style={{ height }} role="img" aria-label={`${title} chart`}><Charts {...chart} /></div></Suspense>}</Card>;
}

export interface TxnRow { id: string; created_at: string; type: string; direction: number; amount: number | string; reference?: string | null; narration?: string | null; status?: string; member?: string }
export function TransactionTable({ rows, loading, showMember, pageSize = 10, onRowClick, compact }: { rows: TxnRow[]; loading?: boolean; showMember?: boolean; pageSize?: number; onRowClick?: (r: TxnRow) => void; compact?: boolean }) {
  const cols: Column<TxnRow>[] = [
    { key: 'desc', header: 'Description', mobileTitle: true, cell: r => <div className="flex items-center gap-3"><span aria-hidden className={cn('grid size-9 shrink-0 place-items-center rounded-full', r.direction === 1 ? 'bg-success-soft text-success' : 'bg-surface2 text-muted')}>
      {r.direction === 1 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><div className="min-w-0"><p className="truncate font-medium">{r.narration || TXN_LABEL[r.type] || r.type}</p>
      {showMember && r.member && <p className="truncate text-xs text-muted">{r.member}</p>}</div></div> },
    { key: 'type', header: 'Type', cell: r => <span className="inline-flex items-center gap-1.5">{r.direction === 1 ? 'Credit' : 'Debit'}<span className="text-muted">· {TXN_LABEL[r.type] ?? r.type}</span></span>, hideOnMobile: true, xlOnly: true, sortBy: r => r.type },
    { key: 'date', header: 'Date', cell: r => <span className="whitespace-nowrap">{date(r.created_at)}</span>, sortBy: r => r.created_at },
    { key: 'status', header: 'Status', cell: r => <StatusBadge status={r.status ?? 'success'} /> },
    { key: 'ref', header: 'Reference', xlOnly: true, cell: r => <span className="font-mono text-xs text-muted">{r.reference ? r.reference.slice(0, 18) + (r.reference.length > 18 ? '…' : '') : '—'}</span> },
    { key: 'amount', header: 'Amount', align: 'right', sortBy: r => Number(r.amount), cell: r => <Money value={naira(r.amount)} sign={r.direction === 1 ? 'credit' : 'debit'} /> },
  ];
  const shown = compact ? cols.filter(c => !['type', 'ref'].includes(c.key)) : cols;
  return <DataTable columns={shown} rows={rows} rowKey={r => r.id} loading={loading} pageSize={pageSize} onRowClick={onRowClick} caption="Transactions"
    empty={<EmptyState title="No transactions found" description="Transactions will appear here once there is activity on the account." />} />;
}
