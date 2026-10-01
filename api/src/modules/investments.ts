import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Db } from '../common/db.js';
import { AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { AmountDto, MatureDto, SchemeDto } from '../common/dto.js';
import { money, notify, postTxn, savingsBalance } from '../common/ledger.js';

@Injectable()
export class InvestmentsService {
  constructor(private db: Db) {}
  async create(u: AuthUser, d: SchemeDto) {
    return this.db.one(`insert into investment_schemes(title,category,description,target_amount,min_amount,duration_months,projected_roi_pct,risk_profile,created_by)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`, [d.title, d.category, d.description ?? null, d.targetAmount, d.minAmount, d.durationMonths, d.projectedRoiPct, d.riskProfile, u.id]);
  }
  async approve(u: AuthUser, id: string) {
    const s = await this.db.one('select created_by,status from investment_schemes where id=$1', [id]);
    if (!s) throw new NotFoundException();
    if (s.status !== 'draft') throw new BadRequestException('Scheme is not a draft');
    if (s.created_by === u.id && u.role !== 'super_admin') throw new ForbiddenException('A scheme must be approved by someone other than its creator');
    return this.db.one("update investment_schemes set status='open',approved_by=$2,opened_at=now() where id=$1 returning *", [id, u.id]);
  }
  list(staff: boolean) {
    return this.db.q(`select s.*, coalesce(sum(x.amount),0) raised, count(x.id) subscribers from investment_schemes s
      left join investment_subscriptions x on x.scheme_id=s.id ${staff ? '' : "where s.status in ('open','closed','matured')"} group by s.id order by s.created_at desc`);
  }
  async subscribe(u: AuthUser, id: string, d: AmountDto) {
    if (!u.memberId) throw new ForbiddenException();
    return this.db.tx(async q => {
      const [s] = await q('select * from investment_schemes where id=$1 for update', [id]);
      if (!s || s.status !== 'open') throw new BadRequestException('Scheme is not open');
      if (d.amount < Number(s.min_amount)) throw new BadRequestException(`Minimum is ₦${Number(s.min_amount).toLocaleString()}`);
      const [{ raised }] = await q('select coalesce(sum(amount),0) raised from investment_subscriptions where scheme_id=$1', [id]);
      if (Number(raised) + d.amount > Number(s.target_amount)) throw new BadRequestException('Exceeds remaining target');
      await q('select 1 from wallets where member_id=$1 for update', [u.memberId]);
      if (d.amount > (await savingsBalance(q, u.memberId!))) throw new BadRequestException('Insufficient savings balance');
      await postTxn(q, { memberId: u.memberId!, type: 'investment_subscription', amount: d.amount, direction: -1, narration: `Subscription: ${s.title}` });
      const [sub] = await q('insert into investment_subscriptions(scheme_id,member_id,amount) values($1,$2,$3) returning *', [id, u.memberId, d.amount]);
      if (Number(raised) + d.amount >= Number(s.target_amount)) await q("update investment_schemes set status='closed' where id=$1", [id]);
      return sub;
    });
  }
  async detail(u: AuthUser, id: string) {
    const s = await this.db.one(`select s.*, coalesce((select sum(amount) from investment_subscriptions where scheme_id=s.id),0) raised,
      (select count(*) from investment_subscriptions where scheme_id=s.id) subscribers from investment_schemes s where s.id=$1`, [id]);
    if (!s || (s.status === 'draft' && u.role === 'member')) throw new NotFoundException();
    const mine = u.memberId ? await this.db.q('select id,amount,payout,created_at from investment_subscriptions where scheme_id=$1 and member_id=$2 order by created_at desc', [id, u.memberId]) : [];
    const base = s.opened_at ?? s.created_at;
    const maturity = new Date(base); maturity.setMonth(maturity.getMonth() + s.duration_months);
    return { ...s, expectedMaturity: maturity.toISOString(), mine };
  }
  portfolio(u: AuthUser) {
    return this.db.q(`select x.*, s.title, s.category, s.status, s.projected_roi_pct, s.duration_months from investment_subscriptions x
      join investment_schemes s on s.id=x.scheme_id where x.member_id=$1 order by x.created_at desc`, [u.memberId]);
  }
  /** Declare the final outcome (profit or loss) and distribute payouts pro-rata to subscribers' savings. */
  async mature(id: string, d: MatureDto) {
    return this.db.tx(async q => {
      const [s] = await q('select * from investment_schemes where id=$1 for update', [id]);
      if (!s) throw new NotFoundException();
      if (!['open', 'closed'].includes(s.status)) throw new BadRequestException('Scheme already matured or not live');
      const subs = await q('select * from investment_subscriptions where scheme_id=$1', [id]);
      for (const x of subs) {
        const payout = money(Number(x.amount) * (1 + d.actualReturnPct / 100));
        await q('update investment_subscriptions set payout=$2 where id=$1', [x.id, payout]);
        if (payout > 0) await postTxn(q, { memberId: x.member_id, type: 'investment_return', amount: payout, direction: 1, narration: `Maturity: ${s.title} (${d.actualReturnPct}%)` });
        await notify(q, x.member_id, 'Investment matured', `${s.title} matured with a ${d.actualReturnPct}% return. ₦${payout.toLocaleString()} credited.`);
      }
      await q("update investment_schemes set status='matured',matured_at=now() where id=$1", [id]);
      return { distributed: subs.length };
    });
  }
}
@Controller('investments')
export class InvestmentsController {
  constructor(private s: InvestmentsService) {}
  @Get() list(@CurrentUser() u: AuthUser) { return this.s.list(u.role !== 'member'); }
  @Get('portfolio') pf(@CurrentUser() u: AuthUser) { return this.s.portfolio(u); }
  @Get(':id') one(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.s.detail(u, id); }
  @Roles('admin') @Post() create(@CurrentUser() u: AuthUser, @Body() d: SchemeDto) { return this.s.create(u, d); }
  @Roles('admin') @Post(':id/approve') approve(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.s.approve(u, id); }
  @Post(':id/subscribe') sub(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: AmountDto) { return this.s.subscribe(u, id, d); }
  @Roles('admin', 'accountant') @Post(':id/mature') mature(@Param('id', ParseUUIDPipe) id: string, @Body() d: MatureDto) { return this.s.mature(id, d); }
}
@Module({ providers: [InvestmentsService], controllers: [InvestmentsController] }) export class InvestmentsModule {}
