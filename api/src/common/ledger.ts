import { Q } from './db.js';

export const money = (n: any) => Math.round(Number(n) * 100) / 100;

export async function savingsBalance(q: Q, memberId: string): Promise<number> {
  const [r] = await q('select coalesce(sum(direction*amount),0) b from transactions where member_id=$1 and affects_savings', [memberId]);
  return money(r.b);
}
export async function notify(q: Q, memberId: string, title: string, body: string) {
  await q('insert into notifications(member_id,title,body) values($1,$2,$3)', [memberId, title, body]);
}
export async function postTxn(q: Q, o: { memberId: string; type: string; amount: number; direction: 1 | -1; affectsSavings?: boolean; reference?: string; narration?: string }) {
  const [t] = await q('insert into transactions(member_id,type,amount,direction,affects_savings,reference,narration) values($1,$2,$3,$4,$5,$6,$7) returning *',
    [o.memberId, o.type, o.amount, o.direction, o.affectsSavings ?? true, o.reference ?? null, o.narration ?? null]);
  return t;
}
/** Apply a repayment to the oldest unpaid instalments; returns amount applied. Closes the loan when fully paid. */
export async function applyRepayment(q: Q, loanId: string, amount: number) {
  let left = amount;
  const rows = await q('select * from loan_schedule where loan_id=$1 order by installment_no for update', [loanId]);
  for (const r of rows) {
    const owed = money(Number(r.principal_due) + Number(r.penalty) - Number(r.paid));
    if (owed <= 0 || left <= 0) continue;
    const pay = Math.min(owed, left);
    await q('update loan_schedule set paid=paid+$2 where id=$1', [r.id, pay]);
    left = money(left - pay);
  }
  const [o] = await q('select count(*) n from loan_schedule where loan_id=$1 and paid < principal_due+penalty', [loanId]);
  if (Number(o.n) === 0) await q("update loans set status='completed' where id=$1", [loanId]);
  return money(amount - left);
}

/**
 * A member's commitment to the cooperative: savings balance plus money currently invested in live schemes.
 * Loan limits are a multiple of this figure. `contributionMonths` (of the last 6) is shown to approvers as context.
 */
export async function commitment(q: Q, memberId: string) {
  const savings = await savingsBalance(q, memberId);
  const [i] = await q("select coalesce(sum(x.amount),0) v from investment_subscriptions x join investment_schemes s on s.id=x.scheme_id where x.member_id=$1 and s.status<>'matured'", [memberId]);
  const [c] = await q("select count(distinct to_char(created_at,'YYYY-MM')) n from transactions where member_id=$1 and type in ('contribution','topup') and created_at > now() - interval '6 months'", [memberId]);
  const invested = money(i.v);
  return { savings, invested, commitment: money(savings + invested), contributionMonths: Number(c.n) };
}
