import { useState } from 'react';
import { CheckCircle2, Clock, Printer } from 'lucide-react';
import { Modal, useAction } from '../ui/overlay';
import { Button, Alert, StatusBadge } from '../ui/primitives';
import { FormField, MoneyInput, OptionCard } from '../ui/forms';
import { api, invalidate } from '../../lib/api';
import { dateTime, naira } from '../../lib/format';

interface Receipt { reference: string; amount: number; provider: string; status: 'success' | 'pending'; at: string; purpose: string }

/** Add savings / repay a loan. Three steps: details → confirm → receipt with reference. */
export default function PayModal({ purpose, loanId, defaultAmount, presets = [5000, 10000, 20000, 50000], title, onClose }: {
  purpose: 'topup' | 'loan_repayment'; loanId?: string; defaultAmount?: number; presets?: number[]; title: string; onClose: () => void;
}) {
  const [step, setStep] = useState<'form' | 'confirm' | 'receipt'>('form'); const [amount, setAmount] = useState<number | ''>(defaultAmount ?? ''); const [provider, setProvider] = useState('paystack'); const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [run, busy] = useAction(() => invalidate());
  const valid = typeof amount === 'number' && amount >= 100 && amount <= 100_000_000;
  const pay = () => run(async () => {
    const i = await api<{ reference: string }>('POST', '/payments/initiate', { provider, purpose, amount, ...(loanId && { loanId }) });
    let status: Receipt['status'] = 'pending';
    try { await api('POST', `/payments/${i.reference}/simulate`); status = 'success'; } catch { /* live gateway: settlement arrives by webhook */ }
    setReceipt({ reference: i.reference, amount: amount as number, provider, status, at: new Date().toISOString(), purpose }); setStep('receipt');
  });
  if (step === 'receipt' && receipt) return <Modal title="Payment receipt" onClose={onClose} footer={<><Button variant="outline" icon={<Printer size={16} />} onClick={() => window.print()}>Print receipt</Button><Button onClick={onClose}>Done</Button></>}>
    <div className="text-center"><div className={`mx-auto mb-3 grid size-14 place-items-center rounded-full ${receipt.status === 'success' ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}>{receipt.status === 'success' ? <CheckCircle2 size={30} /> : <Clock size={30} />}</div>
      <p className="text-sm text-muted">{receipt.status === 'success' ? 'Payment successful' : 'Payment pending'}</p><p className="num text-3xl font-bold">{naira(receipt.amount)}</p></div>
    <dl className="mt-6 divide-y divide-line rounded-xl border border-line text-sm">{[['Reference', <span className="font-mono text-xs">{receipt.reference}</span>], ['Purpose', receipt.purpose === 'topup' ? 'Savings deposit' : 'Loan repayment'], ['Method', receipt.provider === 'paystack' ? 'Paystack' : 'Flutterwave'], ['Date', dateTime(receipt.at)], ['Status', <StatusBadge status={receipt.status} />]].map(([k, v], i) =>
      <div key={i} className="flex items-center justify-between gap-4 px-4 py-3"><dt className="text-muted">{k}</dt><dd className="min-w-0 break-all text-right font-medium">{v}</dd></div>)}</dl>
    {receipt.status === 'pending' && <div className="mt-4"><Alert tone="warning">Your payment is awaiting confirmation from the payment provider. Keep the reference above; your balance updates automatically once it is confirmed.</Alert></div>}</Modal>;
  return <Modal title={title} description={step === 'confirm' ? 'Review before you pay' : undefined} onClose={onClose} footer={step === 'form'
    ? <><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={() => setStep('confirm')}>Continue</Button></>
    : <><Button variant="outline" onClick={() => setStep('form')} disabled={busy}>Back</Button><Button loading={busy} onClick={pay}>Pay {valid ? naira(amount as number) : ''}</Button></>}>
    {step === 'form' ? <>
      <FormField label="Amount" required hint="Minimum ₦100" error={amount !== '' && !valid ? 'Enter an amount between ₦100 and ₦100,000,000' : undefined}><MoneyInput value={amount} onChange={setAmount} autoFocus /></FormField>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Quick amounts">{presets.map(p => <button key={p} type="button" onClick={() => setAmount(p)} className={`h-9 rounded-full border px-3.5 text-sm font-medium num ${amount === p ? 'border-brand bg-brand-soft text-brand' : 'border-line-strong hover:bg-surface2'}`}>{naira(p, { decimals: false })}</button>)}</div>
      <fieldset className="grid gap-2"><legend className="mb-1 text-sm font-medium">Pay with</legend>
        <OptionCard name="provider" selected={provider === 'paystack'} onSelect={() => setProvider('paystack')} title="Paystack" description="Card, bank transfer, direct debit" />
        <OptionCard name="provider" selected={provider === 'flutterwave'} onSelect={() => setProvider('flutterwave')} title="Flutterwave" description="Card, USSD, mobile money" /></fieldset></>
      : <dl className="divide-y divide-line rounded-xl border border-line text-sm">{[['Amount', naira(amount as number)], ['Purpose', purpose === 'topup' ? 'Savings deposit' : 'Loan repayment'], ['Method', provider === 'paystack' ? 'Paystack' : 'Flutterwave'], ['Fees', 'None charged by UnityRise']].map(([k, v]) =>
        <div key={k} className="flex justify-between px-4 py-3"><dt className="text-muted">{k}</dt><dd className="num font-semibold">{v}</dd></div>)}</dl>}
  </Modal>;
}
