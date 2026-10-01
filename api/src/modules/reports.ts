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
    const [loan] = await this.db.q(`select coalesce(sum(s.principal_due+s.interest_due+s.penalty-s.paid),0) outstanding from loan_schedule s join loans l on l.id=s.loan_id where l.member_id=$1 and l.status='active'`, [id]);
    const [ret] = await this.db.q("select coalesce(sum(amount),0) r from transactions where member_id=$1 and type in ('interest','investment_return')", [id]);
    return {
      savings: await savingsBalance(this.db.q, id), invested: Number(inv.invested), loanOutstanding: Number(loan.outstanding), returnsEarned: Number(ret.r),
      upcoming: await this.db.q(`select s.due_date,s.installment_no,(s.principal_due+s.interest_due+s.penalty-s.paid) amount from loan_schedule s join loans l on l.id=s.loan_id
        where l.member_id=$1 and l.status='active' and s.paid < s.principal_due+s.interest_due+s.penalty order by s.due_date limit 3`, [id]),
      recent: await this.db.q('select type,amount,direction,narration,created_at from transactions where member_id=$1 order by created_at desc limit 5', [id]),
      unread: Number((await this.db.one('select count(*) n from notifications where member_id=$1 and read_at is null', [id])).n),
    };
  }
  async admin() {
    const [m] = await this.db.q("select count(*) filter (where kyc_status='approved') members, count(*) filter (where kyc_status='submitted') pending_kyc from members");
    const [s] = await this.db.q("select coalesce(sum(direction*amount),0) savings from transactions where affects_savings");
    const [l] = await this.db.q(`select count(*) filter (where status='active') active_loans, count(*) filter (where status='under_review') pending_loans from loans`);
    return { ...m, ...s, ...l };
  }
  async report(kind: string, memberId?: string) {
    switch (kind) {
      case 'loan-book': return this.db.q(`select l.id,m.membership_id,m.first_name||' '||m.last_name member,l.product_code,l.principal,l.status,
        coalesce(sum(s.principal_due+s.interest_due+s.penalty-s.paid),0) outstanding,
        coalesce(sum(s.principal_due+s.interest_due+s.penalty-s.paid) filter (where s.due_date<current_date),0) arrears
        from loans l join members m on m.id=l.member_id left join loan_schedule s on s.loan_id=l.id where l.status in ('active','completed','defaulted') group by l.id,m.id order by l.created_at`);
      case 'member-savings': return this.db.q(`select m.membership_id,m.first_name||' '||m.last_name member,coalesce(sum(t.direction*t.amount) filter (where t.affects_savings),0) balance
        from members m left join transactions t on t.member_id=m.id where m.kyc_status='approved' group by m.id order by m.membership_id`);
      case 'investments': return this.db.q(`select s.title,s.category,s.status,s.target_amount,s.projected_roi_pct,coalesce(sum(x.amount),0) raised,coalesce(sum(x.payout),0) paid_out
        from investment_schemes s left join investment_subscriptions x on x.scheme_id=s.id group by s.id order by s.created_at`);
      case 'cash-flow': return this.db.q(`select to_char(date_trunc('month',created_at),'YYYY-MM') month,
        sum(amount) filter (where type in ('contribution','topup','loan_repayment')) inflow,
        sum(amount) filter (where type in ('withdrawal','loan_disbursement','investment_return')) outflow from transactions group by 1 order by 1`);
      case 'my-statement': return this.db.q('select created_at,type,narration,case when direction=1 then amount end credit,case when direction=-1 then amount end debit from transactions where member_id=$1 and affects_savings order by created_at', [memberId]);
      default: throw new BadRequestException('Unknown report');
    }
  }
}
@Controller()
export class ReportsController {
  constructor(private s: ReportsService) {}
  @Get('dashboard') dash(@CurrentUser() u: AuthUser) { return this.s.dashboard(u); }
  @Roles('admin', 'accountant', 'loan_officer') @Get('admin/summary') sum() { return this.s.admin(); }
  @Roles('admin', 'accountant') @Get('reports/:kind')
  async rep(@Param('kind') k: string, @Query('format') f: string, @Res() res: Response) {
    if (k === 'my-statement') throw new BadRequestException();
    const rows = await this.s.report(k);
    f === 'csv' ? res.type('text/csv').attachment(`${k}.csv`).send(csv(rows)) : res.json(rows);
  }
  @Get('statement') async stmt(@CurrentUser() u: AuthUser, @Query('format') f: string, @Res() res: Response) {
    if (!u.memberId) throw new ForbiddenException();
    const rows = await this.s.report('my-statement', u.memberId);
    f === 'csv' ? res.type('text/csv').attachment('statement.csv').send(csv(rows)) : res.json(rows);
  }
}
@Module({ providers: [ReportsService], controllers: [ReportsController] }) export class ReportsModule {}
