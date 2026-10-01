import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Query, StreamableFile, Res } from '@nestjs/common';
import { MAX_FILE, sniffFile } from '../common/files.js';
import { Db, Q } from '../common/db.js';
import { AuthUser, CurrentUser, Roles, STAFF } from '../common/auth.js';
import { ConsentDto, KycDocDto, LoanApplyDto, ReviewDto } from '../common/dto.js';
import { commitment, money, notify, postTxn, savingsBalance } from '../common/ledger.js';

const PENALTY_RATE = 0.05;          // one-time late-payment penalty: 5% of the overdue instalment (not interest)

/**
 * Interest-free schedule: equal monthly instalments. Computed in integer kobo; the final instalment absorbs any remainder,
 * so the instalments always sum exactly to the loan amount.
 */
export function buildSchedule(principal: number, months: number, start = new Date()) {
  const total = Math.round(principal * 100); const base = Math.floor(total / months); const rows = [];
  for (let i = 1; i <= months; i++) {
    const prin = i === months ? total - base * (months - 1) : base;
    const due = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, Math.min(start.getUTCDate(), 28)));
    rows.push({ no: i, due: due.toISOString().slice(0, 10), principal: prin / 100 });
  }
  return rows;
}

@Injectable()
export class LoansService {
  constructor(private db: Db) {}
  products() { return this.db.q('select * from loan_products order by code'); }

  async apply(u: AuthUser, d: LoanApplyDto) {
    if (!u.memberId) throw new ForbiddenException();
    return this.db.tx(async q => {
      const [m] = await q('select * from members where id=$1 for update', [u.memberId]); // serialise concurrent applications
      if (m.kyc_status !== 'approved') throw new ForbiddenException('KYC approval required');
      const [p] = await q('select * from loan_products where code=$1', [d.productCode]);
      if (!p) throw new BadRequestException('Unknown loan product');
      if (d.tenorMonths > p.max_tenor_months) throw new BadRequestException(`Maximum tenor is ${p.max_tenor_months} months`);
      const [open] = await q("select count(*) n from loans where member_id=$1 and status in ('guarantors_pending','under_review','approved','active','defaulted')", [u.memberId]);
      if (Number(open.n) > 0) throw new BadRequestException('You already have an open loan or application');
      const c = await commitment(q, u.memberId!);
      const limit = money(c.commitment * Number(p.max_multiple_of_savings));
      if (d.principal > limit) throw new BadRequestException(`Eligibility: maximum for this loan is ₦${limit.toLocaleString()} (${p.max_multiple_of_savings}× your savings and investments of ₦${c.commitment.toLocaleString()})`);
      const ids = [...new Set(d.guarantorMembershipIds)];
      if (ids.length < 2) throw new BadRequestException('Two distinct guarantors required');
      const gs = await q("select id from members where membership_id = any($1) and kyc_status='approved' and id<>$2", [ids, u.memberId]);
      if (gs.length !== ids.length) throw new BadRequestException('Guarantors must be other approved members');
      const [loan] = await q('insert into loans(member_id,product_code,principal,tenor_months,purpose) values($1,$2,$3,$4,$5) returning *',
        [u.memberId, p.code, d.principal, d.tenorMonths, d.purpose ?? null]);
      for (const g of gs) {
        await q('insert into loan_guarantors(loan_id,member_id) values($1,$2)', [loan.id, g.id]);
        await notify(q, g.id, 'Guarantor request', `${m.first_name} ${m.last_name} asked you to guarantee a ₦${d.principal.toLocaleString()} loan.`);
      }
      return loan;
    });
  }
  async eligibility(u: AuthUser, code: string) {
    if (!u.memberId) throw new ForbiddenException();
    const [p] = await this.db.q('select * from loan_products where code=$1', [code]);
    if (!p) throw new NotFoundException();
    const c = await commitment(this.db.q, u.memberId);
    const [open] = await this.db.q("select count(*) n from loans where member_id=$1 and status in ('guarantors_pending','under_review','approved','active','defaulted')", [u.memberId]);
    return { ...c, multiple: Number(p.max_multiple_of_savings), maxAmount: money(c.commitment * Number(p.max_multiple_of_savings)), maxTenor: p.max_tenor_months, hasOpenLoan: Number(open.n) > 0 };
  }
  async addDocument(u: AuthUser, id: string, d: KycDocDto) {
    const l = await this.db.one('select id from loans where id=$1 and member_id=$2', [id, u.memberId]);
    if (!l) throw new NotFoundException();
    const buf = Buffer.from(d.contentBase64, 'base64');
    if (!buf.length || buf.length > MAX_FILE) throw new BadRequestException(`File must be 1B–${MAX_FILE / 1024 / 1024}MB`);
    const type = sniffFile(buf);
    if (!type) throw new BadRequestException('Only JPEG, PNG or PDF files are accepted');
    await this.db.q('insert into loan_documents(loan_id,filename,content,mime) values($1,$2,$3,$4)', [id, d.filename.slice(0, 200), buf, type.mime]);
    return { uploaded: d.filename };
  }
  async detail(id: string) {
    const [l] = await this.db.q(`select l.*,m.first_name,m.last_name,m.membership_id,m.id member_pk from loans l join members m on m.id=l.member_id where l.id=$1`, [id]);
    if (!l) throw new NotFoundException();
    return {
      ...l,
      ...(await commitment(this.db.q, l.member_pk)),
      multiple: Number((await this.db.one('select max_multiple_of_savings m from loan_products where code=$1', [l.product_code])).m),
      guarantors: await this.db.q('select m.first_name,m.last_name,m.membership_id,g.consent from loan_guarantors g join members m on m.id=g.member_id where g.loan_id=$1', [id]),
      approvalsLog: await this.db.q('select u.email,a.decision,a.note,a.created_at from loan_approvals a join users u on u.id=a.approver_id where a.loan_id=$1 order by a.created_at', [id]),
      documents: await this.db.q('select id,filename,created_at from loan_documents where loan_id=$1', [id]),
      schedule: await this.db.q('select installment_no,due_date,principal_due,penalty,paid from loan_schedule where loan_id=$1 order by installment_no', [id]),
    };
  }
  async file(id: string, docId: string) {
    const d = await this.db.one('select filename,content,mime from loan_documents where id=$1 and loan_id=$2', [docId, id]);
    if (!d?.content) throw new NotFoundException();
    return { buffer: d.content as Buffer, type: d.mime ?? 'application/octet-stream', name: d.filename };
  }
  mine(u: AuthUser) { return this.db.q('select * from loans where member_id=$1 order by created_at desc', [u.memberId]); }
  guaranteeRequests(u: AuthUser) {
    return this.db.q(`select l.id loan_id,l.principal,l.tenor_months,m.first_name,m.last_name,g.consent from loan_guarantors g
      join loans l on l.id=g.loan_id join members m on m.id=l.member_id where g.member_id=$1 order by l.created_at desc`, [u.memberId]);
  }
  async consent(u: AuthUser, loanId: string, d: ConsentDto) {
    return this.db.tx(async q => {
      const [g] = await q("update loan_guarantors set consent=$3,responded_at=now() where loan_id=$1 and member_id=$2 and consent='pending' returning *", [loanId, u.memberId, d.consent]);
      if (!g) throw new NotFoundException('No pending request');
      const [loan] = await q('select * from loans where id=$1 for update', [loanId]);
      if (d.consent === 'declined') {
        await q("update loans set status='rejected',rejected_reason='A guarantor declined' where id=$1 and status='guarantors_pending'", [loanId]);
        await notify(q, loan.member_id, 'Loan declined', 'A guarantor declined your request.');
      } else {
        const [r] = await q("select count(*) n from loan_guarantors where loan_id=$1 and consent<>'accepted'", [loanId]);
        if (Number(r.n) === 0) await q("update loans set status='under_review' where id=$1 and status='guarantors_pending'", [loanId]);
      }
      return { consent: d.consent };
    });
  }
  all(status?: string) {
    return this.db.q(`select l.*,m.first_name,m.last_name,m.membership_id from loans l join members m on m.id=l.member_id
      where ($1::text is null or l.status::text=$1) order by l.created_at desc limit 500`, [status ?? null]);
  }
  queue() {
    return this.db.q(`select l.*,m.first_name,m.last_name,m.membership_id from loans l join members m on m.id=l.member_id
      where l.status in ('under_review','approved') order by l.created_at`);
  }
  async review(u: AuthUser, id: string, d: ReviewDto) {
    return this.db.tx(async q => {
      const [loan] = await q('select * from loans where id=$1 for update', [id]);
      if (!loan) throw new NotFoundException();
      if (loan.status !== 'under_review') throw new BadRequestException('Loan is not awaiting approval');
      await q('insert into loan_approvals(loan_id,approver_id,decision,note) values($1,$2,$3,$4)', [id, u.id, d.decision, d.note ?? null])
        .catch((e: any) => { if (e.code === '23505') throw new BadRequestException('You have already reviewed this loan'); throw e; });
      if (d.decision === 'reject') {
        await q("update loans set status='rejected',rejected_reason=$2 where id=$1", [id, d.note ?? 'Rejected']);
        await notify(q, loan.member_id, 'Loan rejected', d.note ?? 'Your loan was not approved.');
        return { status: 'rejected' };
      }
      // One decision from an authorised approver (loan manager or super admin) is final.
      await q("update loans set approvals=1,status='approved' where id=$1", [id]);
      await notify(q, loan.member_id, 'Loan approved', 'Your loan is approved and awaiting disbursement.');
      return { status: 'approved' };
    });
  }
  /** Disbursement: records the payout (bank transfer via NIP to be wired in) and generates the schedule. */
  async disburse(id: string) {
    return this.db.tx(async q => {
      const [loan] = await q('select * from loans where id=$1 for update', [id]);
      if (!loan) throw new NotFoundException();
      if (loan.status !== 'approved') throw new BadRequestException('Loan is not approved');
      const sched = buildSchedule(Number(loan.principal), loan.tenor_months);
      for (const s of sched) await q('insert into loan_schedule(loan_id,installment_no,due_date,principal_due) values($1,$2,$3,$4)', [id, s.no, s.due, s.principal]);
      await q("update loans set status='active',disbursed_at=now() where id=$1", [id]);
      await postTxn(q, { memberId: loan.member_id, type: 'loan_disbursement', amount: Number(loan.principal), direction: 1, affectsSavings: false, reference: `DISB-${id}`, narration: 'Loan disbursement' });
      await notify(q, loan.member_id, 'Loan disbursed', `₦${Number(loan.principal).toLocaleString()} has been disbursed.`);
      return { status: 'active', installments: sched.length };
    });
  }
  async schedule(u: AuthUser, id: string, staff = false) {
    const l = await this.db.one('select member_id from loans where id=$1', [id]);
    if (!l || (!staff && l.member_id !== u.memberId)) throw new NotFoundException();
    return this.db.q('select installment_no,due_date,principal_due,penalty,paid from loan_schedule where loan_id=$1 order by installment_no', [id]);
  }
  /** Apply a one-off late penalty to overdue instalments. Run daily by a scheduler / admin. */
  async runPenalties() {
    const r = await this.db.q(`update loan_schedule s set penalty = round(principal_due*$1,2)
      where penalty=0 and due_date < current_date and paid < principal_due returning loan_id`, [PENALTY_RATE]);
    return { penalised: r.length };
  }
  /** Reminders 7/3/1 days before due date, delivered as in-app notifications (SMS/email adapters plug in here). */
  async runReminders() {
    const r = await this.db.q(`insert into notifications(member_id,title,body)
      select l.member_id,'Repayment reminder','Instalment '||s.installment_no||' of ₦'||(s.principal_due-s.paid)||' is due on '||s.due_date
      from loan_schedule s join loans l on l.id=s.loan_id
      where l.status='active' and s.paid < s.principal_due and (s.due_date - current_date) in (7,3,1) returning 1`);
    return { sent: r.length };
  }
}
@Controller('loans')
export class LoansController {
  constructor(private s: LoansService) {}
  @Get('products') products() { return this.s.products(); }
  @Post() apply(@CurrentUser() u: AuthUser, @Body() d: LoanApplyDto) { return this.s.apply(u, d); }
  @Get('eligibility') elig(@CurrentUser() u: AuthUser, @Query('productCode') c: string) { return this.s.eligibility(u, c); }
  @Post(':id/documents') doc(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: KycDocDto) { return this.s.addDocument(u, id, d); }
  @Roles('loan_manager', 'accountant', 'admin') @Get(':id/detail') detail(@Param('id', ParseUUIDPipe) id: string) { return this.s.detail(id); }
  @Roles('loan_manager', 'accountant', 'admin') @Get(':id/documents/:docId/file')
  async lfile(@Param('id', ParseUUIDPipe) id: string, @Param('docId', ParseUUIDPipe) docId: string, @Res({ passthrough: true }) res: any) {
    const f = await this.s.file(id, docId);
    res.set({ 'Content-Type': f.type, 'Content-Disposition': `inline; filename="${encodeURIComponent(f.name)}"`, 'Cache-Control': 'private, no-store' });
    return new StreamableFile(f.buffer);
  }
  @Get('mine') mine(@CurrentUser() u: AuthUser) { return this.s.mine(u); }
  @Get('guarantee-requests') gr(@CurrentUser() u: AuthUser) { return this.s.guaranteeRequests(u); }
  @Post(':id/consent') consent(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: ConsentDto) { return this.s.consent(u, id, d); }
  @Get(':id/schedule') sched(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.s.schedule(u, id); }
  @Roles('loan_manager', 'accountant', 'admin') @Get('all') all(@Query('status') s?: string) { return this.s.all(s); }
  @Roles('loan_manager', 'accountant', 'admin') @Get('queue') queue() { return this.s.queue(); }
  @Roles('loan_manager') @Post(':id/review') review(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: ReviewDto) { return this.s.review(u, id, d); }
  @Roles('accountant', 'admin') @Post(':id/disburse') disburse(@Param('id', ParseUUIDPipe) id: string) { return this.s.disburse(id); }
  @Roles('admin') @Post('jobs/penalties') pen() { return this.s.runPenalties(); }
  @Roles('admin') @Post('jobs/reminders') rem() { return this.s.runReminders(); }
}
@Module({ providers: [LoansService], controllers: [LoansController], exports: [LoansService] }) export class LoansModule {}
