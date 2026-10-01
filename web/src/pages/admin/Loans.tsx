import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, FileText, XCircle } from 'lucide-react';
import { Alert, Avatar, Button, EmptyState, ErrorState, StatusBadge } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { DataTable, FilterBar, Tabs, TableCard } from '../../components/ui/data';
import { SearchInput } from '../../components/ui/forms';
import { Drawer, useAction, useConfirm } from '../../components/ui/overlay';
import { DocViewer } from '../../components/features/DocViewer';
import { ScheduleTable } from '../member/Loans';
import { api, invalidate, useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { LOAN_LABEL, date, dateTime, naira } from '../../lib/format';

const TABS = [['', 'All'], ['guarantors_pending', 'Awaiting guarantors'], ['under_review', 'Under review'], ['approved', 'Approved'], ['active', 'Active'], ['completed', 'Completed'], ['rejected', 'Rejected']] as const;

function LoanDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { me, can } = useAuth(); const d = useApi<any>(`/loans/${id}/detail`); const confirm = useConfirm(); const [run, busy] = useAction(() => { invalidate(); d.reload(); onChanged(); });
  const x = d.data; const reviewed = x?.approvalsLog?.some((a: any) => a.email === me?.email);
  const review = async (decision: 'approve' | 'reject') => {
    const c = await confirm(decision === 'approve' ? { title: 'Approve this loan?', message: <>You are approving <b className="text-ink">{naira(x.principal)}</b> for {x.first_name} {x.last_name}. This is the final approval; the loan then goes to the accountant for disbursement. Check the member's commitment (savings + investments) first.</>, confirmLabel: 'Approve' }
      : { title: 'Reject this loan?', message: 'The member will see the reason.', confirmLabel: 'Reject loan', tone: 'danger', requireReason: true, reasonLabel: 'Reason shown to the member' });
    if (c.ok) run(() => api('POST', `/loans/${id}/review`, { decision, ...(c.reason && { note: c.reason }) }), decision === 'approve' ? 'Approval recorded' : 'Loan rejected');
  };
  const disburse = async () => { const c = await confirm({ title: 'Disburse this loan?', message: <>This records the payout of <b className="text-ink">{naira(x.principal)}</b> to {x.first_name} {x.last_name} and starts their repayment schedule. It cannot be undone.</>, confirmLabel: 'Disburse funds' }); if (c.ok) run(() => api('POST', `/loans/${id}/disburse`), 'Loan disbursed'); };
  return <Drawer title={x ? `${LOAN_LABEL[x.product_code]} loan` : 'Loan'} subtitle={x ? `${x.first_name} ${x.last_name} · ${x.membership_id}` : undefined} onClose={onClose} width="max-w-2xl" footer={x && <>
    {x.status === 'under_review' && can('loan_manager') && <><Button variant="outline" icon={<XCircle size={16} />} disabled={busy || reviewed} onClick={() => review('reject')}>Reject…</Button><Button icon={<CheckCircle2 size={16} />} loading={busy} disabled={reviewed} onClick={() => review('approve')}>Approve loan</Button></>}
    {x.status === 'approved' && can('accountant', 'admin') && <Button loading={busy} onClick={disburse}>Disburse funds</Button>}</>}>
    {d.loading ? <div className="grid gap-3">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-lg bg-line/70" />)}</div> : d.error || !x ? <ErrorState message={d.error?.message} onRetry={d.reload} /> : <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3"><StatusBadge status={x.status} /><span className="text-sm text-muted">Applied {date(x.created_at)}</span></div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">{[['Amount', naira(x.principal)], ['Tenor', `${x.tenor_months} months`], ['Savings', naira(x.savings)], ['Invested', naira(x.invested)], ['Commitment', naira(x.commitment)], ['Limit for this loan', naira(x.commitment * x.multiple)], ['Months saving (of last 6)', `${x.contributionMonths} / 6`]].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="num font-semibold">{v}</dd></div>)}</dl>
      {x.purpose && <div><p className="text-xs text-muted">Purpose</p><p>{x.purpose}</p></div>}
      {x.rejected_reason && <Alert tone="danger" title="Rejected">{x.rejected_reason}</Alert>}
      <section><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Guarantors</h3><ul className="divide-y divide-line rounded-xl border border-line">{x.guarantors.map((g: any) => <li key={g.membership_id} className="flex items-center gap-3 p-3"><Avatar name={`${g.first_name} ${g.last_name}`} size={32} /><div className="min-w-0 flex-1"><p className="font-medium">{g.first_name} {g.last_name}</p><p className="text-xs text-muted">{g.membership_id}</p></div><StatusBadge status={g.consent === 'pending' ? 'pending' : g.consent} /></li>)}</ul></section>
      <section><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Supporting documents</h3>{x.documents.length ? <ul className="divide-y divide-line rounded-xl border border-line">{x.documents.map((f: any) => <li key={f.id} className="flex items-center gap-3 p-3"><FileText size={18} className="text-muted" /><span className="min-w-0 flex-1 truncate text-sm">{f.filename}</span><DocViewer path={`/loans/${id}/documents/${f.id}/file`} name={f.filename} /></li>)}</ul> : <p className="text-sm text-muted">No documents attached.</p>}</section>
      <section><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Decision</h3>{x.approvalsLog.length ? <ul className="grid gap-2 text-sm">{x.approvalsLog.map((a: any, i: number) => <li key={i} className="flex flex-wrap items-center gap-2"><StatusBadge status={a.decision === 'approve' ? 'approved' : 'rejected'} /><span>{a.email}</span><span className="text-muted">{dateTime(a.created_at)}</span>{a.note && <span className="text-muted">· {a.note}</span>}</li>)}</ul> : <p className="text-sm text-muted">Waiting for a loan manager or the super admin to decide.</p>}</section>
      {x.schedule.length > 0 && <section><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Repayment schedule</h3><ScheduleTable rows={x.schedule} /></section>}</div>}</Drawer>;
}

export default function AdminLoans() {
  const [sp, setSp] = useSearchParams(); const [status, setStatus] = useState(sp.get('status') ?? ''); const [q, setQ] = useState(''); const [open, setOpen] = useState<string | null>(sp.get('open'));
  const l = useApi<any[]>(`/loans/all${status ? `?status=${status}` : ''}`); useEffect(() => { if (sp.get('open') || sp.get('status')) setSp({}, { replace: true }); }, []); // eslint-disable-line
  const rows = (l.data ?? []).filter(r => !q || `${r.first_name} ${r.last_name} ${r.membership_id}`.toLowerCase().includes(q.toLowerCase()));
  if (l.error) return <ErrorState message={l.error.message} onRetry={l.reload} />;
  return <>
    <PageHeader title="Loans" description="Review applications, approve, disburse and monitor repayments." />
    <Tabs value={status} onChange={setStatus} tabs={TABS.map(([k, v]) => ({ key: k, label: v }))} className="mb-5" />
    <TableCard><FilterBar><SearchInput className="sm:w-72" value={q} onChange={setQ} placeholder="Search borrower or ID" /></FilterBar>
      <DataTable rows={rows} rowKey={r => r.id} loading={l.loading} onRowClick={r => setOpen(r.id)} pageSize={10} caption="Loans" empty={<EmptyState title="No loans in this view" />}
        columns={[{ key: 'm', header: 'Borrower', mobileTitle: true, cell: r => <div><p className="font-medium">{r.first_name} {r.last_name}</p><p className="text-xs text-muted">{r.membership_id}</p></div> }, { key: 'p', header: 'Type', cell: r => LOAN_LABEL[r.product_code] },
          { key: 'a', header: 'Amount', align: 'right', sortBy: r => Number(r.principal), cell: r => <span className="num font-semibold">{naira(r.principal)}</span> }, { key: 't', header: 'Tenor', cell: r => `${r.tenor_months} mo`, hideOnMobile: true, xlOnly: true },
          { key: 's', header: 'Status', cell: r => <StatusBadge status={r.status} /> }, { key: 'd', header: 'Applied', sortBy: r => r.created_at, cell: r => date(r.created_at) }]} /></TableCard>
    {open && <LoanDrawer id={open} onClose={() => setOpen(null)} onChanged={l.reload} />}
  </>;
}
