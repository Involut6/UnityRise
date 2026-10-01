import { useMemo } from 'react';
import { useApi } from './api';
import type { TxnRow } from '../components/ui/dashboard';
import { monthLabel } from './format';

export interface Txn extends TxnRow { affects_savings?: boolean }
/** Ledger transactions merged with not-yet-successful gateway payments, newest first. */
export function useMemberTxns() {
  const t = useApi<any[]>('/savings/transactions?limit=500'); const p = useApi<any[]>('/payments/mine');
  const rows = useMemo<Txn[]>(() => {
    const a: Txn[] = (t.data ?? []).map(x => ({ ...x, status: 'success' }));
    const b: Txn[] = (p.data ?? []).filter(x => x.status !== 'success').map(x => ({ id: 'p' + x.id, created_at: x.created_at, type: x.purpose === 'topup' ? 'topup' : 'loan_repayment', direction: 1, amount: x.amount, reference: x.reference,
      narration: `${x.purpose === 'topup' ? 'Deposit' : 'Loan repayment'} via ${x.provider}`, status: x.status, affects_savings: false }));
    return [...a, ...b].sort((m, n) => +new Date(n.created_at) - +new Date(m.created_at));
  }, [t.data, p.data]);
  return { rows, loading: t.loading || p.loading, error: t.error ?? p.error, reload: () => { t.reload(); p.reload(); } };
}

const lastMonths = (n: number) => Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (n - 1 - i)); return d.toISOString().slice(0, 7); });
/** Month-end savings balance (cumulative) for the last n months. */
export function balanceSeries(rows: Txn[], n = 6) {
  const months = lastMonths(n); const ledger = rows.filter(r => r.status === 'success' && r.affects_savings !== false && r.type !== 'loan_disbursement' && r.type !== 'loan_repayment');
  return months.map(m => ({ month: monthLabel(m), balance: ledger.filter(r => r.created_at.slice(0, 7) <= m).reduce((s, r) => s + r.direction * Number(r.amount), 0) }));
}
export function contributionSeries(rows: Txn[], n = 6) {
  return lastMonths(n).map(m => ({ month: monthLabel(m), contributions: rows.filter(r => r.status === 'success' && ['contribution', 'topup'].includes(r.type) && r.created_at.slice(0, 7) === m).reduce((s, r) => s + Number(r.amount), 0) }));
}
