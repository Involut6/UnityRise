import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Avatar, Button, EmptyState, ErrorState, StatusBadge } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { DataTable, Tabs, TableCard } from '../../components/ui/data';
import { Drawer } from '../../components/ui/overlay';
import KycReview from '../../components/features/KycReview';
import { useApi } from '../../lib/api';
import { date } from '../../lib/format';

export default function Kyc() {
  const [tab, setTab] = useState('submitted'); const list = useApi<any[]>(`/members?status=${tab}`); const [sel, setSel] = useState<string | null>(null); const detail = useApi<any>(sel ? `/members/${sel}` : null);
  if (list.error) return <ErrorState message={list.error.message} onRetry={list.reload} />;
  return <>
    <PageHeader title="KYC verification" description="Review identity documents and approve new members." />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'submitted', label: 'Awaiting review', count: tab === 'submitted' ? list.data?.length : undefined }, { key: 'approved', label: 'Approved' }, { key: 'rejected', label: 'Rejected' }, { key: 'draft', label: 'Incomplete' }]} className="mb-5" />
    <TableCard><DataTable rows={list.data ?? []} rowKey={r => r.id} loading={list.loading} onRowClick={r => setSel(r.id)} pageSize={10} caption="KYC applications"
      empty={<EmptyState icon={<ShieldCheck size={22} />} title={tab === 'submitted' ? 'No applications waiting' : 'Nothing here'} description={tab === 'submitted' ? 'New applications show up here as members submit them.' : undefined} />}
      columns={[{ key: 'n', header: 'Applicant', mobileTitle: true, cell: r => <div className="flex items-center gap-3"><Avatar name={`${r.first_name} ${r.last_name}`} /><div className="min-w-0"><p className="truncate font-medium">{r.first_name} {r.last_name}</p><p className="truncate text-xs text-muted">{r.email}</p></div></div> },
        { key: 'd', header: 'Registered', cell: r => date(r.created_at), sortBy: r => r.created_at }, { key: 's', header: 'Status', cell: r => <StatusBadge status={r.kyc_status} /> }, { key: 'a', header: '', align: 'right', cell: () => <Button size="sm" variant="outline">Review</Button>, hideOnMobile: true }]} /></TableCard>
    {sel && <Drawer title="KYC review" subtitle={detail.data ? `${detail.data.first_name} ${detail.data.last_name}` : undefined} onClose={() => setSel(null)} width="max-w-2xl">
      {detail.loading ? <div className="grid gap-3">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-lg bg-line/70" />)}</div> : detail.error || !detail.data ? <ErrorState message={detail.error?.message} onRetry={detail.reload} /> : <KycReview m={detail.data} onDone={() => { setSel(null); list.reload(); }} />}</Drawer>}
  </>;
}
