import { useState } from 'react';
import { Alert, Button } from '../ui/primitives';
import { FormField, Input } from '../ui/forms';
import { Modal, useAction, useConfirm } from '../ui/overlay';
import { api, invalidate } from '../../lib/api';
import { naira } from '../../lib/format';

/** Declare a scheme's final return (profit or loss) and pay investors. Shows the payout and asks for confirmation first. */
export default function MatureModal({ scheme, onClose, onDone }: { scheme: { id: string; title: string; raised: number | string; subscribers?: number | string; investors?: number }; onClose: () => void; onDone?: () => void }) {
  const [ret, setRet] = useState<number | ''>(''); const confirm = useConfirm(); const [run, busy] = useAction(() => { invalidate(); onDone?.(); onClose(); });
  const n = Number(scheme.investors ?? scheme.subscribers ?? 0); const payout = ret === '' ? 0 : Number(scheme.raised) * (1 + ret / 100);
  const declare = async () => {
    const c = await confirm({ title: 'Declare final return?', tone: 'danger', confirmLabel: 'Declare and pay out', message: <>This pays <b className="text-ink">{naira(payout)}</b> to {n} investor{n === 1 ? '' : 's'} at a {ret}% return and closes the scheme. It cannot be undone.</> });
    if (c.ok) run(() => api('POST', `/investments/${scheme.id}/mature`, { actualReturnPct: ret }), 'Returns distributed');
  };
  return <Modal size="sm" title={`Declare return: ${scheme.title}`} onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={ret === ''} loading={busy} onClick={declare}>Review payout</Button></>}>
    <FormField label="Actual return (%)" required hint="Use a negative number to declare a loss."><Input type="number" step="0.1" min={-100} max={500} value={ret} onChange={e => setRet(e.target.value === '' ? '' : Number(e.target.value))} autoFocus /></FormField>
    <dl className="grid gap-2 rounded-xl bg-surface2 p-4 text-sm"><div className="flex justify-between"><dt className="text-muted">Total raised</dt><dd className="num font-semibold">{naira(scheme.raised)}</dd></div><div className="flex justify-between"><dt className="text-muted">Total payout</dt><dd className="num font-semibold">{ret === '' ? '—' : naira(payout)}</dd></div></dl>
    <div className="mt-4"><Alert tone="warning">This is final. Payouts are credited to each investor's savings.</Alert></div></Modal>;
}
