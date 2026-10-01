import { Info, Lock, Timer } from 'lucide-react';
import { Alert, Card, CardHeader, ErrorState } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { DataTable } from '../../components/ui/data';
import { useApi } from '../../lib/api';
import { pct } from '../../lib/format';

export default function Settings() {
  const p = useApi<any[]>('/admin/settings'); if (p.error) return <ErrorState message={p.error.message} onRetry={p.reload} />;
  return <><PageHeader title="Settings" description="Current platform rules. These values are set by the platform team." />
    <div className="grid gap-5"><Card padded={false} className="overflow-hidden"><div className="p-5 pb-0"><CardHeader title="Loan products" subtitle="Rates and limits applied to new applications" /></div>
      <DataTable rows={p.data ?? []} rowKey={r => r.code} loading={p.loading} caption="Loan products" columns={[{ key: 'n', header: 'Product', mobileTitle: true, cell: r => <span className="font-medium">{r.name}</span> }, { key: 'r', header: 'Rate (p.a.)', cell: r => pct(r.annual_rate_pct) }, { key: 'm', header: 'Max borrowing', cell: r => `${r.max_multiple_of_savings}× savings` }, { key: 't', header: 'Max tenor', cell: r => `${r.max_tenor_months} months` }]} /></Card>
      <div className="grid gap-5 md:grid-cols-3">{[[Lock, 'Loan approvals', 'Two different officers must approve a loan before it can be disbursed.'], [Info, 'Late penalty', 'A one-time 5% penalty on an overdue instalment. Applied by the daily penalty job.'], [Timer, 'Session timeout', 'Members and staff are signed out after 15 minutes of inactivity.']].map(([I, t, d]: any) => <Card key={t}><I size={20} className="mb-2 text-brand" /><h3 className="font-semibold">{t}</h3><p className="mt-1 text-sm text-muted">{d}</p></Card>)}</div>
      <Alert tone="info">Changing rates and rules is done by the platform team in the database today. A self-service editor can be added later.</Alert></div></>;
}
