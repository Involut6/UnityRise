import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Db, Q } from '../common/db.js';
import { AuthUser, CurrentUser, Roles } from '../common/auth.js';
import { AmountDto, MatureDto, SchemeDto, SchemeStatusDto, UpdateSchemeDto } from '../common/dto.js';
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
  /** Everything an administrator needs about one scheme: funding, investors, projected vs confirmed figures, timeline, edit history. */
  async manage(id: string) {
    const s = await this.db.one(`select s.*, cu.email created_by_email, au.email approved_by_email from investment_schemes s
      left join users cu on cu.id=s.created_by left join users au on au.id=s.approved_by where s.id=$1`, [id]);
    if (!s) throw new NotFoundException();
    const subs = await this.db.q(`select x.id,x.member_id,x.amount,x.payout,x.created_at,m.first_name,m.last_name,m.membership_id from investment_subscriptions x
      join members m on m.id=x.member_id where x.scheme_id=$1 order by x.created_at desc`, [id]);
    const raised = money(subs.reduce((a, x) => a + Number(x.amount), 0)), target = Number(s.target_amount), roi = Number(s.projected_roi_pct);
    const amounts = subs.map(x => Number(x.amount));
    const byMonth = await this.db.q(`select to_char(date_trunc('month',created_at),'YYYY-MM') as month, sum(amount)::float as amount, count(*)::int as investors
      from investment_subscriptions where scheme_id=$1 group by 1 order by 1`, [id]);
    const edits = await this.db.q(`select e.id,e.changes,e.reason,e.created_at,u.email edited_by from investment_scheme_edits e left join users u on u.id=e.edited_by where e.scheme_id=$1 order by e.id desc limit 100`, [id]);
    const maturity = new Date(s.matured_at ?? s.opened_at ?? s.created_at); if (!s.matured_at) maturity.setMonth(maturity.getMonth() + s.duration_months);
    const confirmed = subs.reduce((a, x) => a + Number(x.payout ?? 0), 0);
    return {
      ...s, raised, remaining: money(Math.max(0, target - raised)), progressPct: target ? Math.min(100, (raised / target) * 100) : 0, investors: subs.length,
      averageTicket: subs.length ? money(raised / subs.length) : 0, largestTicket: amounts.length ? Math.max(...amounts) : 0, smallestTicket: amounts.length ? Math.min(...amounts) : 0,
      projectedPayout: money(raised * (1 + roi / 100)), projectedProfit: money(raised * (roi / 100)),
      confirmedPayout: s.status === 'matured' ? money(confirmed) : null, confirmedProfit: s.status === 'matured' ? money(confirmed - raised) : null,
      confirmedReturnPct: s.status === 'matured' && raised ? Math.round(((confirmed - raised) / raised) * 1000) / 10 : null,
      expectedMaturity: maturity.toISOString(), subscribers: subs, byMonth, edits,
      locks: { matured: s.status === 'matured', hasInvestors: subs.length > 0, minTarget: raised },
    };
  }

  private async record(q: Q, schemeId: string, userId: string, changes: Record<string, { from: unknown; to: unknown }>, reason?: string) {
    await q('insert into investment_scheme_edits(scheme_id,edited_by,changes,reason) values($1,$2,$3,$4)', [schemeId, userId, JSON.stringify(changes), reason ?? null]);
  }

  /**
   * Super-admin edit with integrity rules:
   * - drafts: any field; live schemes: a reason is required and the target cannot drop below what is already raised;
   * - matured schemes are financially final: only the description may change.
   * Material changes (return, duration, risk, minimum) notify existing investors. Every edit is stored with before/after values.
   */
  async update(u: AuthUser, id: string, d: UpdateSchemeDto) {
    const { reason, ...fields } = d;
    return this.db.tx(async q => {
      const [s] = await q('select * from investment_schemes where id=$1 for update', [id]);
      if (!s) throw new NotFoundException();
      const col: Record<string, string> = { title: 'title', category: 'category', description: 'description', targetAmount: 'target_amount', minAmount: 'min_amount', durationMonths: 'duration_months', projectedRoiPct: 'projected_roi_pct', riskProfile: 'risk_profile' };
      const num = new Set(['targetAmount', 'minAmount', 'durationMonths', 'projectedRoiPct']);
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined) continue;
        const from = num.has(k) ? Number(s[col[k]!]) : s[col[k]!]; const to = num.has(k) ? Number(v) : v;
        if (from !== to && !(from == null && to === '')) changes[k] = { from, to };
      }
      if (!Object.keys(changes).length) throw new BadRequestException('No changes to save');
      if (s.status === 'matured' && Object.keys(changes).some(k => k !== 'description')) throw new BadRequestException('A matured scheme is financially final. Only its description can be edited.');
      const [{ raised }] = await q('select coalesce(sum(amount),0) raised from investment_subscriptions where scheme_id=$1', [id]);
      const newTarget = Number((changes.targetAmount?.to as number | undefined) ?? s.target_amount), newMin = Number((changes.minAmount?.to as number | undefined) ?? s.min_amount);
      if (newTarget < Number(raised)) throw new BadRequestException(`The target cannot be below the amount already raised (₦${Number(raised).toLocaleString()})`);
      if (newMin > newTarget) throw new BadRequestException('The minimum investment cannot exceed the target');
      if (s.status !== 'draft' && !reason) throw new BadRequestException('A reason is required when editing a scheme that is already live');
      const sets = Object.keys(changes).map((k, i) => `${col[k]}=$${i + 2}`);
      await q(`update investment_schemes set ${sets.join(',')} where id=$1`, [id, ...Object.values(changes).map(c => c.to)]);
      // A target that is now fully subscribed closes an open scheme.
      if (s.status === 'open' && Number(raised) >= newTarget) { await q("update investment_schemes set status='closed' where id=$1", [id]); changes.status = { from: 'open', to: 'closed' }; }
      await this.record(q, id, u.id, changes, reason);
      const material = ['projectedRoiPct', 'durationMonths', 'riskProfile', 'minAmount', 'targetAmount', 'category'].filter(k => changes[k]);
      if (s.status !== 'draft' && material.length) {
        const label = { projectedRoiPct: 'projected return', durationMonths: 'duration', riskProfile: 'risk profile', minAmount: 'minimum', targetAmount: 'target', category: 'category' } as Record<string, string>;
        for (const m of await q('select distinct member_id from investment_subscriptions where scheme_id=$1', [id]))
          await notify(q, m.member_id, 'Investment terms updated', `${s.title}: ${material.map(k => label[k]).join(', ')} changed. Open the investment to see the details.`);
      }
      return { saved: true, changed: Object.keys(changes) };
    }).then(async r => ({ ...r, scheme: await this.manage(id) }));
  }

  /** Manually stop (close) or resume (reopen) subscriptions on a live scheme. */
  async setStatus(u: AuthUser, id: string, d: SchemeStatusDto) {
    return this.db.tx(async q => {
      const [s] = await q('select * from investment_schemes where id=$1 for update', [id]);
      if (!s) throw new NotFoundException();
      const [{ raised }] = await q('select coalesce(sum(amount),0) raised from investment_subscriptions where scheme_id=$1', [id]);
      if (d.action === 'close') { if (s.status !== 'open') throw new BadRequestException('Only an open scheme can be closed'); }
      else {
        if (s.status !== 'closed') throw new BadRequestException('Only a closed scheme can be reopened');
        if (Number(raised) >= Number(s.target_amount)) throw new BadRequestException('The scheme is fully subscribed. Raise the target before reopening it.');
      }
      if (!d.reason) throw new BadRequestException('A reason is required');
      const to = d.action === 'close' ? 'closed' : 'open';
      await q('update investment_schemes set status=$2 where id=$1', [id, to]);
      await this.record(q, id, u.id, { status: { from: s.status, to } }, d.reason);
      return { status: to };
    });
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
  @Roles('admin', 'accountant') @Get(':id/manage') manage(@Param('id', ParseUUIDPipe) id: string) { return this.s.manage(id); }
  @Roles('super_admin') @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: UpdateSchemeDto) { return this.s.update(u, id, d); }
  @Roles('super_admin') @Post(':id/status') status(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: SchemeStatusDto) { return this.s.setStatus(u, id, d); }
  @Roles('admin') @Post() create(@CurrentUser() u: AuthUser, @Body() d: SchemeDto) { return this.s.create(u, d); }
  @Roles('admin') @Post(':id/approve') approve(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) { return this.s.approve(u, id); }
  @Post(':id/subscribe') sub(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: AmountDto) { return this.s.subscribe(u, id, d); }
  @Roles('admin', 'accountant') @Post(':id/mature') mature(@Param('id', ParseUUIDPipe) id: string, @Body() d: MatureDto) { return this.s.mature(id, d); }
}
@Module({ providers: [InvestmentsService], controllers: [InvestmentsController] }) export class InvestmentsModule {}
