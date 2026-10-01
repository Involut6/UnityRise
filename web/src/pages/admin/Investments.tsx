import { useState } from 'react';
import { CheckCircle2, Plus, Flag } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, PageSkeleton, ProgressBar, StatusBadge, Alert } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { FormField, Input, Select, Textarea, MoneyInput } from '../../components/ui/forms';
import { Modal, useAction, useConfirm } from '../../components/ui/overlay';
import { api, invalidate, useApi } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { CATEGORY_LABEL, naira, pct } from '../../lib/format';
import { RISK_TONE } from '../member/Investments';

function SchemeForm({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ title: '', category: 'real_estate', description: '', target: '' as number | '', min: 0 as number | '', months: 12, roi: '' as number | '', risk: 'medium' }); const [run, busy] = useAction(() => { invalidate(); onClose(); });
  const ok = f.title.length >= 3 && f.target !== '' && f.roi !== '' && f.months > 0;
  return <Modal title="New investment scheme" description="Saved as a draft. A second administrator must approve it before members can invest." onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!ok} loading={busy} onClick={() => run(() => api('POST', '/investments', { title: f.title, category: f.category, description: f.description || undefined, targetAmount: f.target, minAmount: f.min || 0, durationMonths: f.months, projectedRoiPct: f.roi, riskProfile: f.risk }), 'Scheme saved as draft')}>Create draft</Button></>}>
    <FormField label="Title" required><Input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></FormField>
    <div className="grid gap-x-4 sm:grid-cols-2"><FormField label="Category"><Select value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></FormField><FormField label="Risk profile"><Select value={f.risk} onChange={e => setF({ ...f, risk: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></Select></FormField>
      <FormField label="Target amount" required><MoneyInput value={f.target} onChange={v => setF({ ...f, target: v })} /></FormField><FormField label="Minimum per member"><MoneyInput value={f.min} onChange={v => setF({ ...f, min: v })} /></FormField>
      <FormField label="Duration (months)" required><Input type="number" min={1} value={f.months} onChange={e => setF({ ...f, months: Number(e.target.value) })} /></FormField><FormField label="Projected return (%)" required hint="An estimate shown to members as 'projected'"><Input type="number" step="0.1" min={0} value={f.roi} onChange={e => setF({ ...f, roi: e.target.value === '' ? '' : Number(e.target.value) })} /></FormField></div>
    <FormField label="Description"><Textarea value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></FormField></Modal>;
}

export default function AdminInvestments() {
  const { me, can, isAdmin } = useAuth(); const s = useApi<any[]>('/investments'); const confirm = useConfirm(); const [run, busy] = useAction(() => invalidate()); const [form, setForm] = useState(false); const [mature, setMature] = useState<any>(null); const [ret, setRet] = useState<number | ''>('');
  if (s.loading) return <PageSkeleton />;
  if (s.error) return <ErrorState message={s.error.message} onRetry={s.reload} />;
  const approve = async (x: any) => { const c = await confirm({ title: 'Approve and open this scheme?', message: <>Members will be able to invest in <b className="text-ink">{x.title}</b> straight away.</>, confirmLabel: 'Approve & open' }); if (c.ok) run(() => api('POST', `/investments/${x.id}/approve`), 'Scheme is now open'); };
  const payout = mature && ret !== '' ? Number(mature.raised) * (1 + ret / 100) : 0;
  const declare = async () => { const c = await confirm({ title: 'Declare final return?', tone: 'danger', confirmLabel: 'Declare and pay out', message: <>This pays <b className="text-ink">{naira(payout)}</b> to {mature.subscribers} investor{Number(mature.subscribers) === 1 ? '' : 's'} at a {ret}% return and closes the scheme. It cannot be undone.</> }); if (c.ok) run(async () => { await api('POST', `/investments/${mature.id}/mature`, { actualReturnPct: ret }); setMature(null); setRet(''); }, 'Returns distributed'); };
  return <>
    <PageHeader title="Investments" description="Create schemes, approve them and declare returns at maturity." actions={isAdmin ? <Button icon={<Plus size={16} />} onClick={() => setForm(true)}>New scheme</Button> : undefined} />
    {!s.data?.length ? <Card><EmptyState title="No schemes yet" description="Create the first investment scheme for members." action={isAdmin ? <Button onClick={() => setForm(true)}>New scheme</Button> : undefined} /></Card> :
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{s.data.map(x => <Card key={x.id} className="flex flex-col"><div className="mb-2 flex flex-wrap items-center gap-2"><Badge tone="brand">{CATEGORY_LABEL[x.category]}</Badge><Badge tone={RISK_TONE[x.risk_profile as keyof typeof RISK_TONE]}>{x.risk_profile}</Badge><span className="ml-auto"><StatusBadge status={x.status} /></span></div>
        <h3 className="font-semibold">{x.title}</h3><p className="text-sm text-muted">Projected {pct(x.projected_roi_pct)} · {x.duration_months} months · {x.subscribers} investor{Number(x.subscribers) === 1 ? '' : 's'}</p>
        <div className="mt-3"><div className="mb-1 flex justify-between text-sm"><span className="num font-semibold">{naira(x.raised, { compact: true })}</span><span className="text-muted">of {naira(x.target_amount, { compact: true })}</span></div><ProgressBar value={(Number(x.raised) / Number(x.target_amount)) * 100} label="Funding" /></div>
        <div className="mt-4 flex gap-2 sm:mt-auto sm:pt-4">{x.status === 'draft' && isAdmin && (x.created_by === me?.id && me?.role !== 'super_admin' ? <p className="text-sm text-muted">Waiting for another administrator to approve.</p> : <Button className="flex-1" icon={<CheckCircle2 size={16} />} loading={busy} onClick={() => approve(x)}>Approve</Button>)}
          {['open', 'closed'].includes(x.status) && can('admin', 'accountant') && <Button className="flex-1" variant="outline" icon={<Flag size={16} />} onClick={() => { setMature(x); setRet(''); }}>Declare maturity</Button>}</div></Card>)}</div>}
    {form && <SchemeForm onClose={() => setForm(false)} />}
    {mature && <Modal size="sm" title={`Declare return: ${mature.title}`} onClose={() => setMature(null)} footer={<><Button variant="outline" onClick={() => setMature(null)}>Cancel</Button><Button disabled={ret === ''} loading={busy} onClick={declare}>Review payout</Button></>}>
      <FormField label="Actual return (%)" required hint="Use a negative number to declare a loss."><Input type="number" step="0.1" min={-100} max={500} value={ret} onChange={e => setRet(e.target.value === '' ? '' : Number(e.target.value))} autoFocus /></FormField>
      <dl className="grid gap-2 rounded-xl bg-surface2 p-4 text-sm"><div className="flex justify-between"><dt className="text-muted">Total raised</dt><dd className="num font-semibold">{naira(mature.raised)}</dd></div><div className="flex justify-between"><dt className="text-muted">Total payout</dt><dd className="num font-semibold">{ret === '' ? '—' : naira(payout)}</dd></div></dl>
      <div className="mt-4"><Alert tone="warning">This is final. Payouts are credited to each investor's savings.</Alert></div></Modal>}
  </>;
}
