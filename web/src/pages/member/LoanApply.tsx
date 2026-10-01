import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, Badge, Button, Card, ErrorState, PageSkeleton, ProgressBar, StatusBadge } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { FileUpload, FormField, Input, MoneyInput, OptionCard, Textarea } from '../../components/ui/forms';
import { useAction } from '../../components/ui/overlay';
import { api, invalidate, useApi } from '../../lib/api';
import { LOAN_LABEL, fileToBase64, naira } from '../../lib/format';
import { useAuth } from '../../lib/auth';

const STEPS = ['Loan type', 'Amount', 'Eligibility', 'Documents', 'Guarantors', 'Review', 'Submitted'];
const DRAFT = 'ur.loan.draft';
const DOCS = ['Proof of income', 'Supporting document'] as const;

export default function LoanApply() {
  const nav = useNavigate(); const [sp] = useSearchParams(); const { approved } = useAuth(); const prods = useApi<any[]>('/loans/products');
  const draft = useMemo(() => { try { return JSON.parse(sessionStorage.getItem(DRAFT) ?? 'null'); } catch { return null; } }, []);
  const [step, setStep] = useState(0); const [code, setCode] = useState<string>(sp.get('type') ?? draft?.code ?? ''); const [amount, setAmount] = useState<number | ''>(draft?.amount ?? ''); const [tenor, setTenor] = useState<number | ''>(draft?.tenor ?? 12);
  const [purpose, setPurpose] = useState<string>(draft?.purpose ?? ''); const [g, setG] = useState<string[]>(draft?.g ?? ['', '']); const [gName, setGName] = useState<(string | null)[]>([null, null]); const [gErr, setGErr] = useState<(string | null)[]>([null, null]);
  const [files, setFiles] = useState<(File | null)[]>([null, null]); const [done, setDone] = useState<any>(null);
  const prod = prods.data?.find(p => p.code === code); const el = useApi<any>(code && step >= 1 ? `/loans/eligibility?productCode=${code}` : null);
  const [run, busy] = useAction(() => invalidate());
  useEffect(() => { if (!done) try { sessionStorage.setItem(DRAFT, JSON.stringify({ code, amount, tenor, purpose, g })); } catch { /* ignore */ } }, [code, amount, tenor, purpose, g, done]);
  if (!approved) return <Alert tone="warning" title="Verification required">Complete your identity verification before applying for a loan.</Alert>;
  if (prods.loading) return <PageSkeleton />;
  if (prods.error) return <ErrorState message={prods.error.message} onRetry={prods.reload} />;
  const amt = typeof amount === 'number' ? amount : 0, ten = typeof tenor === 'number' ? tenor : 0;
  const checks = el.data && prod ? [
    { ok: !el.data.hasOpenLoan, label: 'No other open loan or application', detail: el.data.hasOpenLoan ? 'Finish or close your current loan first.' : 'You are clear to apply.' },
    { ok: amt > 0 && amt <= el.data.maxAmount, label: 'Amount within your limit', detail: `You can borrow up to ${naira(el.data.maxAmount)}: ${el.data.multiple}× your commitment of ${naira(el.data.commitment)}.` },
    { ok: ten > 0 && ten <= el.data.maxTenor, label: 'Repayment period allowed', detail: `Up to ${el.data.maxTenor} months for this loan type.` }] : [];
  const eligible = checks.length > 0 && checks.every(c => c.ok);
  const lookup = async (i: number) => { const v = g[i]!.trim().toUpperCase(); if (!v) return; try { const r = await api<{ name: string }>('GET', `/members/lookup/${encodeURIComponent(v)}`); setGName(n => n.map((x, j) => (j === i ? r.name : x))); setGErr(n => n.map((x, j) => (j === i ? null : x))); } catch (e: any) { setGName(n => n.map((x, j) => (j === i ? null : x))); setGErr(n => n.map((x, j) => (j === i ? e.message : x))); } };
  const gValid = g.every(x => x.trim()) && new Set(g.map(x => x.trim().toUpperCase())).size === g.length && gName.every(Boolean);
  const next = () => setStep(s => s + 1), back = () => setStep(s => s - 1);
  const can = [!!code, amt >= 1000 && ten >= 1, eligible, true, gValid, true][step] ?? false;
  const submit = () => run(async () => {
    const loan = await api<any>('POST', '/loans', { productCode: code, principal: amt, tenorMonths: ten, purpose: purpose || undefined, guarantorMembershipIds: g.map(x => x.trim().toUpperCase()) });
    for (const f of files) if (f) await api('POST', `/loans/${loan.id}/documents`, { kind: 'photo', filename: f.name, contentBase64: await fileToBase64(f) });
    try { sessionStorage.removeItem(DRAFT); } catch { /* ignore */ } setDone(loan); setStep(6);
  });
  const est = ten > 0 ? amt / ten : 0;
  return <>
    <PageHeader title="Apply for a loan" breadcrumbs={[{ label: 'Loans', to: '/loans' }, { label: 'New application' }]} description={step < 6 ? 'Your progress is saved on this device until you submit.' : undefined} />
    <div className="mb-6" aria-label="Progress"><p className="mb-2 text-sm font-medium"><span className="text-muted">Step {step + 1} of {STEPS.length}:</span> {STEPS[step]}</p><ProgressBar value={((step + 1) / STEPS.length) * 100} label="Application progress" />
      <ol className="mt-3 hidden gap-1 text-xs sm:flex">{STEPS.map((s, i) => <li key={s} className={`flex-1 ${i === step ? 'font-semibold text-brand' : i < step ? 'text-success' : 'text-muted'}`}>{i < step ? '✓ ' : ''}{s}</li>)}</ol></div>
    <div className="mx-auto max-w-2xl"><Card>
      {step === 0 && <fieldset className="grid gap-3"><legend className="mb-3 text-lg font-semibold">What do you need the loan for?</legend>{prods.data?.map(p => <OptionCard key={p.code} name="type" selected={code === p.code} onSelect={() => { setCode(p.code); setTenor(t => Math.min(Number(t) || 12, p.max_tenor_months)); }} title={p.name} description={`Up to ${p.max_multiple_of_savings}× your savings and investments · up to ${p.max_tenor_months} months`} right={<Badge tone="success">Interest-free</Badge>} />)}</fieldset>}
      {step === 1 && prod && <><h2 className="mb-4 text-lg font-semibold">How much do you need?</h2><FormField label="Loan amount" required><MoneyInput value={amount} onChange={setAmount} autoFocus /></FormField>
        <FormField label="Repayment period (months)" required hint={`Up to ${prod.max_tenor_months} months`} error={ten > prod.max_tenor_months ? `Maximum is ${prod.max_tenor_months} months` : undefined}><Input type="number" min={1} max={prod.max_tenor_months} value={tenor} onChange={e => setTenor(e.target.value === '' ? '' : Number(e.target.value))} /></FormField>
        <FormField label="Purpose (optional)"><Textarea value={purpose} maxLength={300} onChange={e => setPurpose(e.target.value)} placeholder="Briefly describe what the money is for" /></FormField>
        {amt > 0 && ten > 0 && <div className="rounded-xl bg-surface2 p-4 text-sm"><p className="text-muted">Monthly repayment</p><p className="num text-2xl font-bold">{naira(est)}</p><p className="mt-1 text-muted">You repay exactly {naira(amt)} over {ten} month{ten === 1 ? '' : 's'}. No interest is charged.</p></div>}</>}
      {step === 2 && <><h2 className="mb-4 text-lg font-semibold">Eligibility check</h2>{el.loading ? <PageSkeleton /> : el.error ? <ErrorState message={el.error.message} onRetry={el.reload} /> : <>
        <div className="mb-4 rounded-xl bg-surface2 p-4 text-sm"><p className="mb-2 font-semibold">Your commitment</p><dl className="grid gap-1.5"><div className="flex justify-between"><dt className="text-muted">Savings balance</dt><dd className="num font-medium">{naira(el.data.savings)}</dd></div><div className="flex justify-between"><dt className="text-muted">Invested in live schemes</dt><dd className="num font-medium">{naira(el.data.invested)}</dd></div><div className="flex justify-between border-t border-line pt-1.5"><dt className="font-medium">Total commitment</dt><dd className="num font-semibold">{naira(el.data.commitment)}</dd></div><div className="flex justify-between"><dt className="text-muted">Borrowing limit ({el.data.multiple}×)</dt><dd className="num font-semibold text-brand">{naira(el.data.maxAmount)}</dd></div></dl><p className="mt-2 text-xs text-muted">Saving regularly and investing raises your limit. Every loan is subject to approval by a loan manager or the super admin.</p></div>
        <ul className="grid gap-3">{checks.map(c => <li key={c.label} className="flex items-start gap-3 rounded-xl border border-line p-3">{c.ok ? <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={20} /> : <XCircle className="mt-0.5 shrink-0 text-danger" size={20} />}<div><p className="font-semibold">{c.label} <span className="sr-only">{c.ok ? '(passed)' : '(failed)'}</span></p><p className="text-sm text-muted">{c.detail}</p></div></li>)}</ul>
        {!eligible && <div className="mt-4"><Alert tone="danger" title="You are not eligible yet">Go back and adjust the amount or period. Adding to your savings or investments raises your limit.</Alert></div>}</>}</>}
      {step === 3 && <><h2 className="mb-1 text-lg font-semibold">Supporting documents</h2><p className="mb-4 text-sm text-muted">Optional, but they help the approver decide faster. For example a payslip, bank statement or invoice.</p>{DOCS.map((d, i) => <FileUpload key={d} label={d} file={files[i]!} onChange={f => setFiles(fs => fs.map((x, j) => (j === i ? f : x)))} />)}</>}
      {step === 4 && <><h2 className="mb-1 text-lg font-semibold">Choose two guarantors</h2><p className="mb-4 text-sm text-muted">Guarantors must be verified members. They will be asked to accept before your loan goes to review.</p>
        {g.map((v, i) => <FormField key={i} label={`Guarantor ${i + 1} · Membership ID`} required error={gErr[i] ?? (v && g.filter(x => x.trim().toUpperCase() === v.trim().toUpperCase()).length > 1 ? 'Choose two different members' : undefined)} hint={gName[i] ? undefined : 'Format: UR-2026-00001'}>
          <div><Input placeholder="UR-2026-00001" value={v} onChange={e => { setG(a => a.map((x, j) => (j === i ? e.target.value : x))); setGName(n => n.map((x, j) => (j === i ? null : x))); }} onBlur={() => lookup(i)} />{gName[i] && <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-success"><CheckCircle2 size={15} />{gName[i]} · verified member</p>}</div></FormField>)}
        <Button variant="outline" size="sm" onClick={() => g.forEach((_, i) => lookup(i))}>Verify IDs</Button></>}
      {step === 5 && prod && <><h2 className="mb-4 text-lg font-semibold">Review your application</h2><dl className="divide-y divide-line rounded-xl border border-line text-sm">{[['Loan type', LOAN_LABEL[code]], ['Amount', naira(amt)], ['Repayment period', `${ten} months`], ['Interest', 'None (interest-free)'], ['Monthly repayment', naira(est)], ['Guarantors', g.map((x, i) => `${gName[i]} (${x.toUpperCase()})`).join(', ')], ['Documents', files.filter(Boolean).map(f => f!.name).join(', ') || 'None attached']].map(([k, v]) => <div key={k} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4"><dt className="text-muted">{k}</dt><dd className="font-medium sm:text-right">{v}</dd></div>)}</dl>
        <div className="mt-4"><Alert tone="info">By submitting you confirm the details are correct. Your guarantors will be notified, then a loan manager or the super admin will review and decide on your application.</Alert></div></>}
      {step === 6 && done && <div className="py-6 text-center"><div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 size={36} /></div><h2 className="text-xl font-bold">Application submitted</h2><p className="mx-auto mt-1 max-w-sm text-muted">We have asked your guarantors to confirm. You will be notified at every stage.</p>
        <div className="mt-4 flex justify-center"><StatusBadge status={done.status} /></div><p className="mt-3 text-xs text-muted">Reference <span className="font-mono">{done.id}</span></p><div className="mt-6 flex justify-center gap-2"><Button onClick={() => nav('/loans')}>Go to my loans</Button><Link to="/"><Button variant="outline">Dashboard</Button></Link></div></div>}
      {step < 6 && <div className="sticky bottom-20 -mx-5 mt-6 flex justify-between gap-3 border-t border-line bg-surface px-5 pt-4 md:static md:bottom-auto"><Button variant="outline" onClick={step === 0 ? () => nav('/loans') : back} icon={<ArrowLeft size={16} />} disabled={busy}>{step === 0 ? 'Cancel' : 'Back'}</Button>
        {step < 5 ? <Button onClick={next} disabled={!can} icon={<ArrowRight size={16} />} className="flex-row-reverse">Continue</Button> : <Button onClick={submit} loading={busy}>Submit application</Button>}</div>}
    </Card></div>
  </>;
}
export { AlertCircle };
