import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, PiggyBank, Users } from 'lucide-react';
import { Button, ErrorState } from '../../components/ui/primitives';
import { PageHeader, StatCard } from '../../components/ui/dashboard';
import { DataTable, FilterBar, TableCard } from '../../components/ui/data';
import { SearchInput } from '../../components/ui/forms';
import { saveFile, useApi } from '../../lib/api';
import { naira } from '../../lib/format';

export default function AdminSavings() {
  const r = useApi<any[]>('/reports/member-savings'); const o = useApi<any>('/admin/overview'); const nav = useNavigate(); const [q, setQ] = useState('');
  const rows = (r.data ?? []).filter(x => !q || `${x.member} ${x.membership_id}`.toLowerCase().includes(q.toLowerCase()));
  if (r.error) return <ErrorState message={r.error.message} onRetry={r.reload} />;
  return <><PageHeader title="Savings" description="Member savings balances." actions={<Button variant="outline" icon={<Download size={16} />} onClick={() => saveFile('/reports/member-savings?format=csv', 'member-savings.csv')}>Export Excel</Button>} />
    <div className="mb-5 grid gap-4 sm:grid-cols-2"><StatCard icon={<PiggyBank size={20} />} label="Total savings held" value={naira(o.data?.totalSavings ?? 0)} /><StatCard icon={<Users size={20} />} tone="info" label="Members with a wallet" value={r.data?.length ?? 0} /></div>
    <TableCard><FilterBar><SearchInput className="sm:w-72" value={q} onChange={setQ} placeholder="Search member or ID" /></FilterBar>
      <DataTable rows={rows} rowKey={x => x.membership_id} loading={r.loading} pageSize={12} caption="Member savings" columns={[{ key: 'm', header: 'Member', mobileTitle: true, sortBy: x => x.member, cell: x => <span className="font-medium">{x.member}</span> }, { key: 'i', header: 'Membership ID', cell: x => <span className="font-mono text-xs">{x.membership_id}</span> }, { key: 'b', header: 'Balance', align: 'right', sortBy: x => Number(x.balance), cell: x => <span className="num font-semibold">{naira(x.balance)}</span> }]} /></TableCard></>;
}
