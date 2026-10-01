import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { EmptyState, ErrorState } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { DataTable, FilterBar, TableCard } from '../../components/ui/data';
import { SearchInput } from '../../components/ui/forms';
import { Drawer } from '../../components/ui/overlay';
import { useApi } from '../../lib/api';
import { dateTime } from '../../lib/format';

export default function Audit() {
  const a = useApi<any[]>('/admin/audit?limit=500'); const [q, setQ] = useState(''); const [sel, setSel] = useState<any>(null);
  const rows = (a.data ?? []).filter(x => !q || `${x.action} ${x.actor ?? ''} ${x.ip ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  if (a.error) return <ErrorState message={a.error.message} onRetry={a.reload} />;
  return <><PageHeader title="Audit logs" description="A permanent record of every action that changes data." />
    <TableCard><FilterBar><SearchInput className="sm:w-80" value={q} onChange={setQ} placeholder="Search action, user or IP" /></FilterBar>
      <DataTable rows={rows} rowKey={x => String(x.id)} loading={a.loading} pageSize={15} onRowClick={setSel} caption="Audit log" empty={<EmptyState icon={<ScrollText size={22} />} title="No entries match" />}
        columns={[{ key: 't', header: 'When', mobileTitle: true, sortBy: x => x.created_at, cell: x => dateTime(x.created_at) }, { key: 'u', header: 'Actor', cell: x => x.actor ?? <span className="text-muted">anonymous</span> }, { key: 'a', header: 'Action', cell: x => <span className="font-mono text-xs">{x.action}</span> }, { key: 'i', header: 'IP', hideOnMobile: true, cell: x => <span className="font-mono text-xs text-muted">{x.ip ?? '—'}</span> }]} /></TableCard>
    {sel && <Drawer title="Audit entry" subtitle={dateTime(sel.created_at)} onClose={() => setSel(null)} width="max-w-lg"><dl className="mb-4 grid gap-3 text-sm"><div><dt className="text-xs text-muted">Actor</dt><dd className="font-medium">{sel.actor ?? 'anonymous'}</dd></div><div><dt className="text-xs text-muted">Action</dt><dd className="font-mono">{sel.action}</dd></div></dl>
      <p className="mb-1 text-xs text-muted">Details (sensitive fields are never stored)</p><pre className="overflow-x-auto rounded-xl bg-surface2 p-4 text-xs">{JSON.stringify(sel.detail, null, 2)}</pre></Drawer>}</>;
}
