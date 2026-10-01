import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button, ErrorState, StatusBadge } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { DataTable, FilterBar, TableCard } from '../../components/ui/data';
import { SearchInput, Select } from '../../components/ui/forms';
import { useApi } from '../../lib/api';
import { dateTime, downloadText, naira, toCsv } from '../../lib/format';

export default function Payments() {
  const [status, setStatus] = useState(''); const [q, setQ] = useState(''); const p = useApi<any[]>(`/admin/payments${status ? `?status=${status}` : ''}`);
  const rows = (p.data ?? []).filter(x => !q || `${x.member} ${x.membership_id} ${x.reference}`.toLowerCase().includes(q.toLowerCase()));
  if (p.error) return <ErrorState message={p.error.message} onRetry={p.reload} />;
  return <><PageHeader title="Payments" description="Gateway payments and their settlement status." actions={<Button variant="outline" icon={<Download size={16} />} disabled={!rows.length} onClick={() => downloadText('payments.csv', toCsv(rows.map(x => ({ Date: x.created_at, Member: x.member, ID: x.membership_id, Provider: x.provider, Purpose: x.purpose, Amount: x.amount, Status: x.status, Reference: x.reference }))))}>Export</Button>} />
    <TableCard><FilterBar><SearchInput className="sm:w-72" value={q} onChange={setQ} placeholder="Search member or reference" /><div className="sm:w-44"><Select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option><option value="success">Successful</option><option value="pending">Pending</option><option value="failed">Failed</option></Select></div></FilterBar>
      <DataTable rows={rows} rowKey={x => x.id} loading={p.loading} pageSize={12} caption="Payments" columns={[{ key: 'm', header: 'Member', mobileTitle: true, cell: x => <div><p className="font-medium">{x.member}</p><p className="text-xs text-muted">{x.membership_id}</p></div> }, { key: 'p', header: 'Purpose', cell: x => (x.purpose === 'topup' ? 'Savings deposit' : 'Loan repayment') }, { key: 'v', header: 'Provider', xlOnly: true, cell: x => <span className="capitalize">{x.provider}</span> },
        { key: 'a', header: 'Amount', align: 'right', sortBy: x => Number(x.amount), cell: x => <span className="num font-semibold">{naira(x.amount)}</span> }, { key: 's', header: 'Status', cell: x => <StatusBadge status={x.status} /> }, { key: 'd', header: 'Date', sortBy: x => x.created_at, cell: x => dateTime(x.created_at) }, { key: 'r', header: 'Reference', xlOnly: true, cell: x => <span className="font-mono text-xs text-muted">{x.reference.slice(0, 16)}…</span> }]} /></TableCard></>;
}
