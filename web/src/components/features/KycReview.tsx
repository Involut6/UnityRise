import { CheckCircle2, FileText, XCircle } from 'lucide-react';
import { Alert, Button, StatusBadge } from '../ui/primitives';
import { useAction, useConfirm } from '../ui/overlay';
import { DocViewer } from './DocViewer';
import { api, invalidate } from '../../lib/api';
import { date, dateTime } from '../../lib/format';
import { useAuth } from '../../lib/auth';

const KIND: Record<string, string> = { photo: 'Passport photograph', id_card: 'Government ID', signature: 'Signature', proof_of_address: 'Proof of address' };

/** Applicant info, documents, verification history and approve/reject (with confirmation). `m` comes from GET /members/:id. */
export default function KycReview({ m, onDone }: { m: any; onDone?: () => void }) {
  const { can } = useAuth(); const confirm = useConfirm(); const [run, busy] = useAction(() => { invalidate(); onDone?.(); });
  const review = async (decision: 'approve' | 'reject') => {
    const c = await confirm(decision === 'approve'
      ? { title: 'Approve this member?', message: <>This verifies <b className="text-ink">{m.first_name} {m.last_name}</b>, issues a Membership ID and opens their savings wallet.</>, confirmLabel: 'Approve member' }
      : { title: 'Reject this application?', message: 'The member will be told why and can resubmit.', confirmLabel: 'Reject', tone: 'danger', requireReason: true, reasonLabel: 'Reason shown to the member' });
    if (c.ok) run(() => api('POST', `/members/${m.id}/review`, { decision, ...(c.reason && { note: c.reason }) }), decision === 'approve' ? 'Member approved' : 'Application rejected');
  };
  const docs: any[] = m.documents ?? [];
  return <div className="grid gap-6">
    <section><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Applicant</h3><dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">{[['Name', `${m.first_name} ${m.last_name}`], ['Email', m.email], ['Phone', m.phone], ['Date of birth', date(m.date_of_birth)], ['BVN', m.bvn ?? '—'], ['NIN', m.nin ?? '—'], ['Address', m.address ?? '—'], ['Registered', date(m.created_at)]].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl></section>
    <section><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Identity documents</h3>{docs.length ? <ul className="divide-y divide-line rounded-xl border border-line">{docs.map(d => <li key={d.id} className="flex items-center gap-3 p-3"><FileText size={20} className="shrink-0 text-muted" /><div className="min-w-0 flex-1"><p className="font-medium">{KIND[d.kind] ?? d.kind}</p><p className="truncate text-xs text-muted">{d.filename} · {date(d.created_at)}</p></div><DocViewer path={`/members/${m.id}/documents/${d.id}/file`} name={d.filename} label={KIND[d.kind]} /></li>)}</ul> : <p className="text-sm text-muted">No documents uploaded.</p>}</section>
    <section><h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Verification</h3><div className="flex flex-wrap items-center gap-3 text-sm"><StatusBadge status={m.kyc_status} />{m.approved_at && <span className="text-muted">Approved {dateTime(m.approved_at)}</span>}{m.reviewer && <span className="text-muted">by {m.reviewer}</span>}</div>
      {m.kyc_note && <div className="mt-3"><Alert tone={m.kyc_status === 'rejected' ? 'danger' : 'info'} title="Reviewer note">{m.kyc_note}</Alert></div>}</section>
    {m.kyc_status === 'submitted' && can('admin') && <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row"><Button className="flex-1" icon={<CheckCircle2 size={16} />} loading={busy} onClick={() => review('approve')}>Approve</Button><Button className="flex-1" variant="outline" icon={<XCircle size={16} />} disabled={busy} onClick={() => review('reject')}>Reject…</Button></div>}
  </div>;
}
