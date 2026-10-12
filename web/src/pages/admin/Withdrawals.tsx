import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button, ErrorState, StatusBadge } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { DataTable, FilterBar, TableCard } from '../../components/ui/data';
import { SearchInput, Select } from '../../components/ui/forms';
import { useAction, useConfirm } from '../../components/ui/overlay';
import { api, invalidate, useApi } from '../../lib/api';
import { dateTime, naira } from '../../lib/format';

export default function Withdrawals() {
  const [status, setStatus] = useState('pending'); const [q, setQ] = useState(''); const confirm = useConfirm();
  const w = useApi<any[]>(`/admin/withdrawals${status ? `?status=${status}` : ''}`); const [run, busy] = useAction(() => { invalidate(); w.reload(); });
  const rows = (w.data ?? []).filter(x => !q || `${x.member} ${x.membership_id} ${x.account_name} ${x.account_number}`.toLowerCase().includes(q.toLowerCase()));
  const pay = async (x: any) => {
    const c = await confirm({ title: 'Mark as paid?', confirmLabel: 'Mark as paid', message: <>Confirm you have transferred <b className="text-ink">{naira(x.amount)}</b> to <b className="text-ink">{x.account_name}</b>, {x.bank_name} {x.account_number}. This debits the member's savings and cannot be undone.</> });
    if (c.ok) run(() => api('POST', `/admin/withdrawals/${x.id}/review`, { decision: 'paid' }), 'Marked as paid');
  };
  const reject = async (x: any) => {
    const c = await confirm({ title: 'Reject this request?', confirmLabel: 'Reject', tone: 'danger', requireReason: true, reasonLabel: 'Reason (shown to the member)', message: <>{x.member}'s request for <b className="text-ink">{naira(x.amount)}</b> will be declined and the money returns to their available balance.</> });
    if (c.ok) run(() => api('POST', `/admin/withdrawals/${x.id}/review`, { decision: 'reject', note: c.reason }), 'Request rejected');
  };
  if (w.error) return <ErrorState message={w.error.message} onRetry={w.reload} />;
  return <><PageHeader title="Withdrawals" description="Member requests to take money out of their savings. Pay the account shown, then mark the request as paid." />
    <TableCard><FilterBar><SearchInput className="sm:w-72" value={q} onChange={setQ} placeholder="Search member or account" />
      <div className="sm:w-44"><Select aria-label="Status" value={status} onChange={e => setStatus(e.target.value)}><option value="pending">Pending</option><option value="paid">Paid</option><option value="rejected">Rejected</option><option value="cancelled">Cancelled</option><option value="">All</option></Select></div></FilterBar>
      <DataTable rows={rows} rowKey={x => x.id} loading={w.loading} pageSize={12} caption="Withdrawal requests" empty="No withdrawal requests here." columns={[
        { key: 'm', header: 'Member', mobileTitle: true, cell: x => <div><p className="font-medium">{x.member}</p><p className="text-xs text-muted">{x.membership_id}</p></div> },
        { key: 'a', header: 'Amount', align: 'right', sortBy: x => Number(x.amount), cell: x => <span className="num font-semibold">{naira(x.amount)}</span> },
        { key: 'b', header: 'Pay to', cell: x => <div><p className="font-medium">{x.account_name}</p><p className="text-xs text-muted">{x.bank_name} · <span className="font-mono">{x.account_number}</span></p></div> },
        { key: 'r', header: 'Reason', xlOnly: true, cell: x => <span className="text-muted">{x.reason || '—'}</span> },
        { key: 's', header: 'Status', cell: x => <StatusBadge status={x.status} /> },
        { key: 'd', header: 'Requested', sortBy: x => x.created_at, cell: x => dateTime(x.created_at) },
        { key: 'x', header: '', align: 'right', cell: x => x.status === 'pending' ? <div className="flex justify-end gap-2"><Button size="sm" icon={<Check size={15} />} loading={busy} onClick={() => pay(x)}>Mark paid</Button><Button size="sm" variant="outline" icon={<X size={15} />} onClick={() => reject(x)}>Reject</Button></div> : <span className="text-xs text-muted">{x.review_note}</span> }]} /></TableCard></>;
}
