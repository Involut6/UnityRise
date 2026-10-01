import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button, ErrorState } from '../../components/ui/primitives';
import { PageHeader, TransactionTable } from '../../components/ui/dashboard';
import { FilterBar, TableCard } from '../../components/ui/data';
import { SearchInput, Select } from '../../components/ui/forms';
import { useApi } from '../../lib/api';
import { TXN_LABEL, dateTime, downloadText, toCsv } from '../../lib/format';

export default function AdminTransactions() {
  const [q, setQ] = useState(''); const [type, setType] = useState(''); const t = useApi<any[]>(`/admin/transactions?${new URLSearchParams({ ...(q && { q }), ...(type && { type }), limit: '500' })}`);
  if (t.error) return <ErrorState message={t.error.message} onRetry={t.reload} />;
  const rows = (t.data ?? []).map(r => ({ ...r, status: 'success' }));
  return <><PageHeader title="Transactions" description="Every ledger entry across the cooperative." actions={<Button variant="outline" icon={<Download size={16} />} disabled={!rows.length} onClick={() => downloadText('transactions.csv', toCsv(rows.map(r => ({ Date: r.created_at, Member: r.member, ID: r.membership_id, Type: TXN_LABEL[r.type] ?? r.type, Direction: r.direction === 1 ? 'Credit' : 'Debit', Amount: r.amount, Reference: r.reference ?? '', Narration: r.narration ?? '' }))))}>Export</Button>} />
    <TableCard><FilterBar><SearchInput className="sm:w-72" value={q} onChange={setQ} placeholder="Search member, ID or reference" /><div className="sm:w-52"><Select aria-label="Type" value={type} onChange={e => setType(e.target.value)}><option value="">All types</option>{Object.entries(TXN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></div></FilterBar>
      <TransactionTable rows={rows} loading={t.loading} showMember pageSize={15} /></TableCard></>;
}
export { dateTime };
