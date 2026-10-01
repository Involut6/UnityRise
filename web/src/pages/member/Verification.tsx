import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { Alert, Button, Card, ProgressBar } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/dashboard';
import { FileUpload, FormField, Input, Textarea, DatePicker } from '../../components/ui/forms';
import { useAction } from '../../components/ui/overlay';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { fileToBase64 } from '../../lib/format';
import { Link } from 'react-router-dom';

const DOCS: [string, string, string][] = [['photo', 'Passport photograph', 'A clear, recent photo of your face'], ['id_card', 'Government ID', 'NIN slip, driver’s licence, passport or voter’s card'], ['signature', 'Signature', 'Your signature on plain white paper'], ['proof_of_address', 'Proof of address', 'Utility bill or bank statement, last 3 months']];
export default function Verification() {
  const { me, refresh } = useAuth(); const [step, setStep] = useState(0); const [v, setV] = useState({ dob: '', bvn: '', nin: '', address: '' }); const [files, setFiles] = useState<Record<string, File | null>>({}); const [run, busy] = useAction(refresh);
  if (me?.kyc_status === 'approved') return <><PageHeader title="Verification" /><Card><div className="flex items-center gap-4"><span className="grid size-12 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 size={26} /></span><div><p className="text-lg font-semibold">You're verified</p><p className="text-muted">Membership ID <b className="text-ink">{me.membership_id}</b></p></div><Link to="/" className="ml-auto"><Button>Go to dashboard</Button></Link></div></Card></>;
  if (me?.kyc_status === 'submitted') return <><PageHeader title="Verification" /><Card className="mx-auto max-w-xl text-center"><span className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-warning-soft text-warning"><Clock size={28} /></span><h2 className="text-xl font-bold">Under review</h2><p className="mt-1 text-muted">Thanks, we have your documents. An administrator is reviewing them and you will be notified when it is done, usually within a couple of working days.</p></Card></>;
  const errs = { bvn: v.bvn && !/^\d{11}$/.test(v.bvn) ? 'BVN is 11 digits' : '', nin: v.nin && !/^\d{11}$/.test(v.nin) ? 'NIN is 11 digits' : '', address: v.address && v.address.length < 5 ? 'Enter your full address' : '' };
  const s1 = !!v.dob && /^\d{11}$/.test(v.bvn) && /^\d{11}$/.test(v.nin) && v.address.length >= 5, s2 = DOCS.every(([k]) => files[k]);
  const submit = () => run(async () => {
    await api('PUT', '/members/me/kyc', { dateOfBirth: v.dob, bvn: v.bvn, nin: v.nin, address: v.address });
    for (const [k] of DOCS) { const f = files[k]!; await api('POST', '/members/me/kyc/documents', { kind: k, filename: f.name, contentBase64: await fileToBase64(f) }); }
    await api('POST', '/members/me/kyc/submit');
  }, 'Submitted for review');
  return <><PageHeader title="Verify your identity" description="We are required to confirm who our members are. This takes about 5 minutes." />
    <div className="mx-auto max-w-2xl">{me?.kyc_status === 'rejected' && <div className="mb-5"><Alert tone="danger" title="Your last submission was not approved">{me.kyc_note ?? 'Please review your details and resubmit.'}</Alert></div>}
      <div className="mb-5"><p className="mb-2 text-sm font-medium"><span className="text-muted">Step {step + 1} of 3:</span> {['Personal details', 'Documents', 'Review & submit'][step]}</p><ProgressBar value={((step + 1) / 3) * 100} label="Verification progress" /></div>
      <Card>{step === 0 && <><FormField label="Date of birth" required><DatePicker value={v.dob} max={new Date().toISOString().slice(0, 10)} onChange={e => setV({ ...v, dob: e.target.value })} /></FormField>
        <div className="grid gap-x-4 sm:grid-cols-2"><FormField label="BVN" required error={errs.bvn} hint="11 digits. Dial *565*0# to get yours."><Input inputMode="numeric" maxLength={11} value={v.bvn} onChange={e => setV({ ...v, bvn: e.target.value.replace(/\D/g, '') })} /></FormField>
          <FormField label="NIN" required error={errs.nin} hint="11-digit National Identification Number"><Input inputMode="numeric" maxLength={11} value={v.nin} onChange={e => setV({ ...v, nin: e.target.value.replace(/\D/g, '') })} /></FormField></div>
        <FormField label="Residential address" required error={errs.address}><Textarea value={v.address} onChange={e => setV({ ...v, address: e.target.value })} /></FormField></>}
        {step === 1 && <>{DOCS.map(([k, l, h]) => <FileUpload key={k} label={l} hint={h} file={files[k] ?? null} onChange={f => setFiles(x => ({ ...x, [k]: f }))} />)}</>}
        {step === 2 && <><dl className="divide-y divide-line rounded-xl border border-line text-sm">{[['Date of birth', v.dob], ['BVN', `*******${v.bvn.slice(-4)}`], ['NIN', `*******${v.nin.slice(-4)}`], ['Address', v.address], ...DOCS.map(([k, l]) => [l, files[k]?.name ?? '—'])].map(([k, x]) => <div key={k} className="flex justify-between gap-4 px-4 py-3"><dt className="text-muted">{k}</dt><dd className="min-w-0 truncate text-right font-medium">{x}</dd></div>)}</dl>
          <div className="mt-4"><Alert tone="info" title="Your data is protected" >We only use these documents to verify your identity, in line with the Nigeria Data Protection Act.</Alert></div></>}
        <div className="mt-6 flex justify-between gap-3"><Button variant="outline" disabled={step === 0 || busy} onClick={() => setStep(s => s - 1)} icon={<ArrowLeft size={16} />}>Back</Button>
          {step < 2 ? <Button disabled={step === 0 ? !s1 : !s2} onClick={() => setStep(s => s + 1)} icon={<ArrowRight size={16} />} className="flex-row-reverse">Continue</Button> : <Button loading={busy} onClick={submit} icon={<ShieldCheck size={16} />}>Submit for review</Button>}</div></Card></div></>;
}
