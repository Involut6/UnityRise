import { useState } from 'react';
import { Modal, useAction, useConfirm } from '../ui/overlay';
import { Button, Alert } from '../ui/primitives';
import { FormField, MoneyInput } from '../ui/forms';
import { api, invalidate, useApi } from '../../lib/api';
import { naira, pct } from '../../lib/format';

export default function InvestModal({ scheme, onClose }: { scheme: any; onClose: () => void }) {
  const w = useApi<any>('/savings'); const [amount, setAmount] = useState<number | ''>(Number(scheme.min_amount) || ''); const confirm = useConfirm(); const [run, busy] = useAction(() => { invalidate(); onClose(); });
  const remaining = Number(scheme.target_amount) - Number(scheme.raised ?? 0); const bal = w.data?.balance ?? 0;
  const err = typeof amount !== 'number' ? undefined : amount < Number(scheme.min_amount) ? `Minimum is ${naira(scheme.min_amount)}` : amount > remaining ? `Only ${naira(remaining)} left in this scheme` : amount > bal ? 'This is more than your available savings' : undefined;
  const go = async () => {
    const c = await confirm({ title: 'Confirm investment', message: <>Invest <b className="text-ink">{naira(amount as number)}</b> from your savings in <b className="text-ink">{scheme.title}</b>? The projected return of {pct(scheme.projected_roi_pct)} is an estimate and is not guaranteed.</>, confirmLabel: 'Invest now' });
    if (c.ok) run(() => api('POST', `/investments/${scheme.id}/subscribe`, { amount }), 'Investment confirmed');
  };
  return <Modal size="sm" title={`Invest in ${scheme.title}`} onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={busy} disabled={typeof amount !== 'number' || !!err} onClick={go}>Continue</Button></>}>
    <p className="mb-4 text-sm text-muted">Funds are taken from your savings balance: <b className="num text-ink">{naira(bal)}</b> available.</p>
    <FormField label="Amount to invest" required error={err} hint={`Minimum ${naira(scheme.min_amount)} · ${naira(remaining)} remaining`}><MoneyInput value={amount} onChange={setAmount} autoFocus /></FormField>
    {typeof amount === 'number' && !err && amount > 0 && <Alert tone="info" title="Projected (not guaranteed)">If the scheme performs as expected, {naira(amount)} could return about <b className="num">{naira(amount * (1 + Number(scheme.projected_roi_pct) / 100))}</b> at maturity.</Alert>}</Modal>;
}
