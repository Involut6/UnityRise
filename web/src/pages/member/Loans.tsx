import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, HandCoins, UserCheck } from 'lucide-react';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, ErrorState, PageSkeleton, ProgressBar, StatusBadge } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { DataTable } from '../../components/ui/data';
import { Modal, useAction, useConfirm } from '../../components/ui/overlay';
import PayModal from '../../components/features/PayModal';
import { api, invalidate, useApi } from '../../lib/api';
import { useMoney } from '../../lib/privacy';
import { LOAN_LABEL, date, naira } from '../../lib/format';

export function ScheduleTable({ rows }: { rows: any[] }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="px-3 py-2">#</th><th className="px-3 py-2">Due</th><th className="px-3 py-2 text-right">Principal</th><th className="px-3 py-2 text-right">Penalty</th><th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2">Status</th></tr></thead>
    <tbody>{rows.map(r => { const due = Number(r.principal_due) + Number(r.penalty), paid = Number(r.paid), late = new Date(r.due_date) < new Date() && paid < due; return <tr key={r.installment_no} className="border-b border-line last:border-0">
      <td className="px-3 py-2 num">{r.installment_no}</td><td className="px-3 py-2 whitespace-nowrap">{date(r.due_date)}</td><td className="px-3 py-2 text-right num">{naira(r.principal_due)}</td><td className="px-3 py-2 text-right num">{Number(r.penalty) ? naira(r.penalty) : '—'}</td><td className="px-3 py-2 text-right num">{naira(paid)}</td>
      <td className="px-3 py-2"><StatusBadge status={paid >= due ? 'completed' : late ? 'failed' : 'pending'} /></td></tr>; })}</tbody></table></div>;
}

export default function Loans() {
  const nav = useNavigate(); const m = useMoney(); const mine = useApi<any[]>('/loans/mine'); const prods = useApi<any[]>('/loans/products'); const gr = useApi<any[]>('/loans/guarantee-requests'); const confirm = useConfirm();
  const active = mine.data?.find(l => l.status === 'active'); const sched = useApi<any[]>(active ? `/loans/${active.id}/schedule` : null);
  const [showSched, setShowSched] = useState(false); const [pay, setPay] = useState(false); const [run] = useAction(() => invalidate());
  const info = useMemo(() => { const s = sched.data; if (!s?.length) return null; const tot = (r: any) => Number(r.principal_due) + Number(r.penalty); const total = s.reduce((a, r) => a + tot(r), 0), paid = s.reduce((a, r) => a + Number(r.paid), 0); const next = s.find(r => Number(r.paid) < tot(r));
    return { total, paid, outstanding: total - paid, pct: total ? (paid / total) * 100 : 0, next, nextDue: next ? tot(next) - Number(next.paid) : 0, overdue: next && new Date(next.due_date) < new Date() }; }, [sched.data]);
  const respond = async (g: any, consent: 'accepted' | 'declined') => {
    const c = await confirm({ title: consent === 'accepted' ? 'Guarantee this loan?' : 'Decline request?', tone: consent === 'accepted' ? 'primary' : 'danger', confirmLabel: consent === 'accepted' ? 'Yes, guarantee' : 'Decline',
      message: consent === 'accepted' ? <>You agree to stand as guarantor for <b className="text-ink">{g.first_name} {g.last_name}</b>'s loan of <b className="text-ink">{naira(g.principal)}</b>. If they cannot repay, you may be asked to help.</> : 'The applicant will be told their request was declined.' });
    if (c.ok) run(() => api('POST', `/loans/${g.loan_id}/consent`, { consent }), consent === 'accepted' ? 'You are now a guarantor' : 'Request declined');
  };
  if (mine.loading || prods.loading) return <PageSkeleton />;
  if (mine.error) return <ErrorState message={mine.error.message} onRetry={mine.reload} />;
  const pending = gr.data?.filter(g => g.consent === 'pending') ?? []; const history = mine.data ?? [];
  return <>
    <PageHeader title="Loans" description="Apply, track and repay your cooperative loans." actions={<Button icon={<HandCoins size={16} />} onClick={() => nav('/loans/apply')}>Apply for a loan</Button>} />
    {!!pending.length && <div className="mb-5 grid gap-3">{pending.map(g => <Alert key={g.loan_id} tone="warning" title="Guarantee request" action={<div className="flex shrink-0 flex-col gap-2 sm:flex-row"><Button size="sm" onClick={() => respond(g, 'accepted')}>Accept</Button><Button size="sm" variant="outline" onClick={() => respond(g, 'declined')}>Decline</Button></div>}>
      {g.first_name} {g.last_name} asked you to guarantee a <b className="num">{naira(g.principal)}</b> loan over {g.tenor_months} months.</Alert>)}</div>}
    {active && info ? <Card className="mb-5"><div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2"><h2 className="text-base font-semibold">{LOAN_LABEL[active.product_code]} loan</h2><StatusBadge status="active" /></div><p className="text-sm text-muted">Disbursed {date(active.disbursed_at)} · {active.tenor_months} equal monthly instalments</p></div>
      <div className="mt-3 flex gap-2 sm:mt-0"><Button variant="outline" onClick={() => setShowSched(true)} icon={<CalendarClock size={16} />}>Schedule</Button><Button onClick={() => setPay(true)}>Repay</Button></div></div>
      <div className="mt-5 grid gap-5 sm:grid-cols-3"><div><p className="text-sm text-muted">Outstanding balance</p><p className="num text-2xl font-bold">{m(info.outstanding)}</p></div><div><p className="text-sm text-muted">Next repayment</p><p className="num text-2xl font-bold">{m(info.nextDue)}</p><p className={`text-sm ${info.overdue ? 'font-semibold text-danger' : 'text-muted'}`}>{info.overdue ? 'Overdue since ' : 'Due '}{date(info.next?.due_date)}</p></div><div><p className="text-sm text-muted">Original loan</p><p className="num text-2xl font-bold">{m(active.principal)}</p></div></div>
      <div className="mt-5"><div className="mb-1.5 flex justify-between text-sm"><span className="text-muted">Repayment progress</span><span className="num font-semibold">{Math.round(info.pct)}% · {m(info.paid)} paid</span></div><ProgressBar value={info.pct} tone="success" label="Repayment progress" /></div></Card>
      : <Card className="mb-5"><EmptyState icon={<HandCoins size={22} />} title="No active loan" description="When a loan is disbursed, your balance, next repayment and progress show here." action={<Button onClick={() => nav('/loans/apply')}>Apply for a loan</Button>} /></Card>}
    <section aria-labelledby="types"><h2 id="types" className="mb-3 text-base font-semibold">Available loan types</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{prods.data?.map(p => <Card key={p.code} className="flex flex-col"><div className="mb-2 flex items-start justify-between gap-2"><h3 className="font-semibold">{p.name}</h3><Badge tone="success">Interest-free</Badge></div>
        <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted">Borrow up to</dt><dd className="font-medium">{p.max_multiple_of_savings}× your savings + investments</dd></div><div><dt className="text-xs text-muted">Repay within</dt><dd className="font-medium">{p.max_tenor_months} months</dd></div></dl>
        <div className="mt-auto pt-4"><Link to={`/loans/apply?type=${p.code}`}><Button variant="secondary" block>Apply</Button></Link></div></Card>)}</div></section>
    <Card padded={false} className="mt-6 overflow-hidden"><div className="p-5 pb-0"><CardHeader title="Loan history" /></div>
      <DataTable rows={history} rowKey={r => r.id} pageSize={8} caption="Loan history" empty={<EmptyState title="No loans yet" description="Your applications and loans will be listed here." />}
        columns={[{ key: 'p', header: 'Loan', mobileTitle: true, cell: r => <span className="font-medium">{LOAN_LABEL[r.product_code]}</span> }, { key: 'a', header: 'Amount', cell: r => <span className="num font-semibold">{naira(r.principal)}</span>, sortBy: r => Number(r.principal) }, { key: 't', header: 'Tenor', cell: r => `${r.tenor_months} mo`, hideOnMobile: true },
          { key: 'd', header: 'Applied', cell: r => date(r.created_at), sortBy: r => r.created_at }, { key: 's', header: 'Status', cell: r => <><StatusBadge status={r.status} />{r.rejected_reason && <p className="mt-1 text-xs text-muted">{r.rejected_reason}</p>}</> }]} /></Card>
    {showSched && sched.data && <Modal size="lg" title="Repayment schedule" onClose={() => setShowSched(false)}><ScheduleTable rows={sched.data} /></Modal>}
    {pay && active && info && <PayModal purpose="loan_repayment" loanId={active.id} title="Repay loan" defaultAmount={Math.round(info.nextDue * 100) / 100} presets={[Math.round(info.nextDue), Math.round(info.outstanding)].filter((v, i, a) => v > 0 && a.indexOf(v) === i)} onClose={() => { setPay(false); mine.reload(); sched.reload(); }} />}
  </>;
}
export { UserCheck };
