import { Controller, Get, Injectable, Module, Param, Query, Res, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Response } from 'express';
import { Db } from '../common/db';
import { AuthUser, CurrentUser, Roles } from '../common/auth';
import { savingsBalance } from '../common/ledger';

const csv = (rows: any[]) => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  // Prefix cells starting with = + - @ to neutralise spreadsheet formula injection.
  const cell = (v: any) => { let s = v instanceof Date ? v.toISOString() : String(v ?? ''); if (/^[=+\-@]/.test(s) && isNaN(Number(s))) s = `'${s}`; return `"${s.replace(/"/g, '""')}"`; };
  return [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n');
};

@Injectable()
export class ReportsService {
  constructor(private db: Db) {}
  async dashboard(u: AuthUser) {
    const id = u.memberId;
    if (!id) throw new ForbiddenException();
    const [inv] = await this.db.q(`select coalesce(sum(x.amount),0) invested from investment_subscriptions x join investment_schemes s on s.id=x.scheme_id where x.member_id=$1 and s.status<>'matured'`, [id]);
    const [loan] = await this.db.q(`select coalesce(sum(s.principal_due+s.penalty-s.paid),0) outstanding from loan_schedule s join loans l on l.id=s.loan_id where l.member_id=$1 and l.status='active'`, [id]);
    const [ret] = await this.db.q("select coalesce(sum(amount),0) r from transactions where member_id=$1 and type = 'investment_return'", [id]);
    return {
      savings: await savingsBalance(this.db.q, id), invested: Number(inv.invested), loanOutstanding: Number(loan.outstanding), returnsEarned: Number(ret.r),
      upcoming: await this.db.q(`select s.due_date,s.installment_no,(s.principal_due+s.penalty-s.paid) amount from loan_schedule s join loans l on l.id=s.loan_id
        where l.member_id=$1 and l.status='active' and s.paid < s.principal_due+s.penalty order by s.due_date limit 3`, [id]),
      recent: await this.db.q('select type,amount,direction,narration,created_at from transactions where member_id=$1 order by created_at desc limit 5', [id]),
      unread: Number((await this.db.one('select count(*) n from notifications where member_id=$1 and read_at is null', [id])).n),
    };
  }
  async overview() {
    const [m] = await this.db.q("select count(*) total, count(*) filter (where kyc_status='approved') active, count(*) filter (where kyc_status='submitted') pending_kyc from members");
    const [s] = await this.db.q('select coalesce(sum(direction*amount),0) savings from transactions where affects_savings');
    const [i] = await this.db.q("select coalesce(sum(x.amount),0) invested from investment_subscriptions x join investment_schemes s on s.id=x.scheme_id where s.status<>'matured'");
    const [l] = await this.db.q(`select count(*) filter (where l.status='active') active_loans, count(*) filter (where l.status='under_review') pending_loans from loans l`);
    const [o] = await this.db.q(`select coalesce(sum(s.principal_due+s.penalty-s.paid),0) outstanding,
      coalesce(sum(least(s.paid,s.principal_due+s.penalty)) filter (where s.due_date<=current_date),0) paid_due,
      coalesce(sum(s.principal_due+s.penalty) filter (where s.due_date<=current_date),0) due
      from loan_schedule s join loans l on l.id=s.loan_id where l.status='active'`);
    const series = await this.db.q(`with months as (select to_char(d,'YYYY-MM') m from generate_series(date_trunc('month',now())-interval '5 months',date_trunc('month',now()),'1 month') d)
      select months.m as month,
        coalesce((select sum(amount) from transactions t where t.type in ('contribution','topup') and to_char(t.created_at,'YYYY-MM')=months.m),0) savings_in,
        coalesce((select sum(amount) from transactions t where t.type='loan_disbursement' and to_char(t.created_at,'YYYY-MM')=months.m),0) loans_out,
        coalesce((select count(*) from members mm where to_char(mm.approved_at,'YYYY-MM')=months.m),0) new_members
      from months order by 1`);
    const recent = await this.db.q(`select t.id,t.type,t.amount,t.direction,t.created_at,m.first_name||' '||m.last_name member from transactions t join members m on m.id=t.member_id order by t.created_at desc limit 8`);
    const byProduct = await this.db.q("select product_code name, count(*)::int value from loans where status in ('active','completed') group by 1");
    return {
      totalMembers: Number(m.total), activeMembers: Number(m.active), pendingKyc: Number(m.pending_kyc), totalSavings: Number(s.savings), totalInvestments: Number(i.invested),
      activeLoans: Number(l.active_loans), pendingLoans: Number(l.pending_loans), outstandingLoans: Number(o.outstanding),
      repaymentRate: Number(o.due) > 0 ? Math.round((Number(o.paid_due) / Number(o.due)) * 1000) / 10 : 100, series, recent, byProduct,
    };
  }
  async admin() {
    const [m] = await this.db.q("select count(*) filter (where kyc_status='approved') members, count(*) filter (where kyc_status='submitted') pending_kyc from members");
    const [s] = await this.db.q("select coalesce(sum(direction*amount),0) savings from transactions where affects_savings");
    const [l] = await this.db.q(`select count(*) filter (where status='active') active_loans, count(*) filter (where status='under_review') pending_loans from loans`);
    return { ...m, ...s, ...l };
  }
  async report(kind: string, memberId?: string, from?: string, to?: string) {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    if ((from && !iso.test(from)) || (to && !iso.test(to))) throw new BadRequestException('Dates must be YYYY-MM-DD');
    const f = from || '1900-01-01', t = to || '2999-12-31';
    switch (kind) {
      case 'transactions': return this.db.q(`select t.created_at,m.membership_id,m.first_name||' '||m.last_name member,t.type,t.direction,t.amount,t.reference,t.narration
        from transactions t join members m on m.id=t.member_id where t.created_at::date between $1 and $2 order by t.created_at desc limit 5000`, [f, t]);
      case 'members': return this.db.q(`select m.membership_id,m.first_name,m.last_name,u.email,u.phone,m.kyc_status,m.approved_at joined from members m join users u on u.id=m.user_id
        where m.created_at::date between $1 and $2 order by m.created_at`, [f, t]);
      case 'regulatory': return this.db.q(`select m.membership_id,m.first_name||' '||m.last_name member,m.approved_at::date joined,
        coalesce(sum(t.amount) filter (where t.type in ('contribution','topup') and t.created_at::date between $1 and $2),0) contributions,
        coalesce(sum(t.direction*t.amount) filter (where t.affects_savings),0) balance from members m left join transactions t on t.member_id=m.id
        where m.kyc_status='approved' group by m.id order by m.membership_id`, [f, t]);
      case 'loan-book': return this.db.q(`select l.id,m.membership_id,m.first_name||' '||m.last_name member,l.product_code,l.principal,l.status,
        coalesce(sum(s.principal_due+s.penalty-s.paid),0) outstanding,
        coalesce(sum(s.principal_due+s.penalty-s.paid) filter (where s.due_date<current_date),0) arrears
        from loans l join members m on m.id=l.member_id left join loan_schedule s on s.loan_id=l.id where l.status in ('active','completed','defaulted') group by l.id,m.id order by l.created_at`);
      case 'member-savings': return this.db.q(`select m.membership_id,m.first_name||' '||m.last_name member,coalesce(sum(t.direction*t.amount) filter (where t.affects_savings),0) balance
        from members m left join transactions t on t.member_id=m.id where m.kyc_status='approved' group by m.id order by m.membership_id`);
      case 'investments': return this.db.q(`select s.title,s.category,s.status,s.target_amount,s.projected_roi_pct,coalesce(sum(x.amount),0) raised,coalesce(sum(x.payout),0) paid_out
        from investment_schemes s left join investment_subscriptions x on x.scheme_id=s.id group by s.id order by s.created_at`);
      case 'cash-flow': return this.db.q(`select to_char(date_trunc('month',created_at),'YYYY-MM') as month,
        sum(amount) filter (where type in ('contribution','topup','loan_repayment')) inflow,
        sum(amount) filter (where type in ('withdrawal','loan_disbursement','investment_return')) outflow from transactions group by 1 order by 1`);
      case 'my-statement': return this.db.q('select created_at,type,narration,case when direction=1 then amount end credit,case when direction=-1 then amount end debit from transactions where member_id=$1 and affects_savings and created_at::date between $2 and $3 order by created_at', [memberId, f, t]);
      default: throw new BadRequestException('Unknown report');
    }
  }
}
@Controller()
export class ReportsController {
  constructor(private s: ReportsService) {}
  @Get('dashboard') dash(@CurrentUser() u: AuthUser) { return this.s.dashboard(u); }
  @Roles('admin', 'accountant', 'loan_manager') @Get('admin/summary') sum() { return this.s.admin(); }
  @Roles('admin', 'accountant', 'loan_manager') @Get('admin/overview') ov() { return this.s.overview(); }
  @Roles('admin', 'accountant') @Get('reports/:kind')
  async rep(@Param('kind') k: string, @Query('format') f: string, @Query('from') from: string, @Query('to') to: string, @Res() res: Response) {
    if (k === 'my-statement') throw new BadRequestException();
    const rows = await this.s.report(k, undefined, from, to);
    f === 'csv' ? res.type('text/csv').attachment(`${k}.csv`).send(csv(rows)) : res.json(rows);
  }
  @Get('statement') async stmt(@CurrentUser() u: AuthUser, @Query('format') f: string, @Query('from') from: string, @Query('to') to: string, @Res() res: Response) {
    if (!u.memberId) throw new ForbiddenException();
    const rows = await this.s.report('my-statement', u.memberId, from, to);
    f === 'csv' ? res.type('text/csv').attachment('statement.csv').send(csv(rows)) : res.json(rows);
  }
}
@Module({ providers: [ReportsService], controllers: [ReportsController] }) export class ReportsModule {}
