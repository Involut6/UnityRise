import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import { Avatar, Button, EmptyState, ErrorState, StatusBadge } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { DataTable, FilterBar, TableCard } from '../../components/ui/data';
import { SearchInput, Select } from '../../components/ui/forms';
import { useApi } from '../../lib/api';
import { date, downloadText, naira, toCsv } from '../../lib/format';

export default function Members() {
  const nav = useNavigate(); const [q, setQ] = useState(''); const [kyc, setKyc] = useState(''); const [loan, setLoan] = useState('');
  const m = useApi<any[]>(`/members?${new URLSearchParams({ ...(q && { q }), ...(kyc && { status: kyc }) })}`);
  const rows = (m.data ?? []).filter(r => !loan || (loan === 'none' ? !r.loan_status : r.loan_status === loan));
  if (m.error) return <ErrorState message={m.error.message} onRetry={m.reload} />;
  return <>
    <PageHeader title="Members" description="Everyone registered with the cooperative." actions={<Button variant="outline" icon={<Download size={16} />} disabled={!rows.length} onClick={() => downloadText('members.csv', toCsv(rows.map(r => ({ MembershipID: r.membership_id ?? '', Name: `${r.first_name} ${r.last_name}`, Email: r.email, Phone: r.phone, KYC: r.kyc_status, Savings: r.savings, LoanStatus: r.loan_status ?? '', Registered: r.created_at }))))}>Export</Button>} />
    <TableCard><FilterBar><SearchInput className="sm:w-72" value={q} onChange={setQ} placeholder="Search name, ID or email" />
      <div className="sm:w-44"><Select aria-label="KYC status" value={kyc} onChange={e => setKyc(e.target.value)}><option value="">All KYC statuses</option><option value="draft">Draft</option><option value="submitted">Submitted</option><option value="approved">Approved</option><option value="rejected">Rejected</option></Select></div>
      <div className="sm:w-44"><Select aria-label="Loan status" value={loan} onChange={e => setLoan(e.target.value)}><option value="">All loan states</option><option value="none">No loan</option><option value="active">Active loan</option><option value="under_review">Under review</option><option value="completed">Completed</option><option value="defaulted">Defaulted</option></Select></div></FilterBar>
      <DataTable rows={rows} rowKey={r => r.id} loading={m.loading} pageSize={12} onRowClick={r => nav(`/admin/members/${r.id}`)} caption="Members" empty={<EmptyState title="No members found" description="Try a different search or filter." />}
        columns={[{ key: 'n', header: 'Member', mobileTitle: true, sortBy: r => `${r.first_name} ${r.last_name}`, cell: r => <div className="flex items-center gap-3"><Avatar name={`${r.first_name} ${r.last_name}`} /><div className="min-w-0"><p className="truncate font-medium">{r.first_name} {r.last_name}</p><p className="truncate text-xs text-muted">{r.membership_id ?? 'No ID yet'} · {r.email}</p></div></div> },
          { key: 'k', header: 'KYC', cell: r => <StatusBadge status={r.kyc_status} /> }, { key: 's', header: 'Savings', align: 'right', sortBy: r => Number(r.savings), cell: r => <span className="num font-semibold">{naira(r.savings)}</span> },
          { key: 'l', header: 'Loan', cell: r => r.loan_status ? <StatusBadge status={r.loan_status} /> : <span className="text-muted">None</span> }, { key: 'd', header: 'Registered', sortBy: r => r.created_at, cell: r => date(r.created_at) }]} /></TableCard></>;
}
