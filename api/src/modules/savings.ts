import { Logger, BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Module, Post, Put, Query, Headers, RawBodyRequest, Req, UnauthorizedException, Param } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { config } from '../common/config';
import { PROVIDERS, Provider, signatureValid, toKobo } from '../common/payment-utils';
import { Db } from '../common/db';
import { AuthUser, CurrentUser, Public, Roles } from '../common/auth';
import { AmountDto, PayInitDto, TargetDto } from '../common/dto';
import { applyRepayment, money, notify, postTxn, savingsBalance } from '../common/ledger';

@Injectable()
export class SavingsService {
  private log = new Logger('payments');
  constructor(private db: Db) {}
  private mid(u: AuthUser) {
    if (!u.memberId) throw new ForbiddenException();
    return u.memberId;
  }
  private async approved(u: AuthUser) {
    const m = await this.db.one('select kyc_status from members where id=$1', [this.mid(u)]);
    if (m.kyc_status !== 'approved') throw new ForbiddenException('KYC approval required');
  }
  async wallet(u: AuthUser) {
    await this.approved(u);
    const w = await this.db.one('select monthly_target from wallets where member_id=$1', [u.memberId]);
    const [t] = await this.db.q(`select coalesce(sum(amount) filter (where type in ('contribution','topup')),0) contributions,
      coalesce(sum(amount) filter (where type = 'investment_return'),0) returns from transactions where member_id=$1`, [u.memberId]);
    const [p] = await this.db.q("select coalesce(sum(amount),0) pending from payments where member_id=$1 and status='pending' and purpose='topup'", [u.memberId]);
    return { balance: await savingsBalance(this.db.q, u.memberId!), monthlyTarget: Number(w.monthly_target), totalContributions: Number(t.contributions), returns: Number(t.returns), pendingDeposits: Number(p.pending) };
  }
  async setTarget(u: AuthUser, d: TargetDto) { await this.approved(u); await this.db.q('update wallets set monthly_target=$2 where member_id=$1', [u.memberId, d.monthlyTarget]); return { ok: true }; }
  async history(u: AuthUser, limit = 50) { return this.db.q('select id,type,amount,direction,affects_savings,reference,narration,created_at from transactions where member_id=$1 order by created_at desc limit $2', [this.mid(u), Math.min(limit, 500)]); }
  async myPayments(u: AuthUser) { return this.db.q('select id,provider,reference,purpose,amount,status,created_at,settled_at from payments where member_id=$1 order by created_at desc limit 100', [this.mid(u)]); }
  async withdraw(u: AuthUser, d: AmountDto) {
    await this.approved(u);
    return this.db.tx(async q => {
      await q('select 1 from wallets where member_id=$1 for update', [u.memberId]); // serialise per-member balance changes
      const bal = await savingsBalance(q, u.memberId!);
      const [{ held }] = await q(`select coalesce(sum(l.principal),0) held from loans l where l.member_id=$1 and l.status in ('active','approved')`, [u.memberId]);
      if (d.amount > bal - Number(held) * 0.1) throw new BadRequestException('Insufficient withdrawable balance (10% of active loans is held as security)');
      await postTxn(q, { memberId: u.memberId!, type: 'withdrawal', amount: d.amount, direction: -1, reference: `WD-${randomUUID()}`, narration: 'Savings withdrawal request' });
      return { balance: await savingsBalance(q, u.memberId!) };
    });
  }
  // ---- payments (gateway adapters are stubbed: swap initiate() for the Paystack/Flutterwave SDK once keys exist) ----
  async initiate(u: AuthUser, d: PayInitDto) {
    await this.approved(u);
    if (d.purpose === 'loan_repayment') {
      const l = d.loanId && await this.db.one("select id from loans where id=$1 and member_id=$2 and status='active'", [d.loanId, u.memberId]);
      if (!l) throw new BadRequestException('Active loan required');
    }
    const ref = `UR-${d.provider.slice(0, 2).toUpperCase()}-${randomUUID()}`;
    await this.db.q('insert into payments(member_id,provider,reference,purpose,purpose_ref,amount) values($1,$2,$3,$4,$5,$6)', [u.memberId, d.provider, ref, d.purpose, d.loanId ?? null, d.amount]);
    return { reference: ref, checkoutUrl: `https://checkout.example/${d.provider}/${ref}`, note: 'Gateway keys not configured; use /payments/:ref/simulate in non-production.' };
  }
  /** Idempotent settlement: only a pending payment can transition, guarded by a row lock. */
  async settle(ref: string, ok: boolean, o: { provider?: Provider; providerKobo?: number; memberId?: string } = {}) {
    return this.db.tx(async q => {
      const [p] = await q('select * from payments where reference=$1 for update', [ref]);
      if (!p || (o.memberId && p.member_id !== o.memberId) || (o.provider && p.provider !== o.provider)) throw new BadRequestException('Unknown reference');
      if (p.status !== 'pending') return { status: p.status, duplicate: true };
      const expectedKobo = Math.round(Number(p.amount) * 100);
      // Never credit money the gateway did not report: a successful event must carry exactly the amount we initiated.
      if (ok && o.providerKobo !== undefined && o.providerKobo !== expectedKobo) {
        this.log.warn(JSON.stringify({ event: 'payment.amount_mismatch', ref, expectedKobo, providerKobo: o.providerKobo }));
        await q("update payments set status='failed',settled_at=now(),provider_amount=$2 where id=$1", [p.id, o.providerKobo / 100]);
        return { status: 'failed', reason: 'amount_mismatch' };
      }
      if (!ok) { await q("update payments set status='failed',settled_at=now() where id=$1", [p.id]); return { status: 'failed' }; }
      await q("update payments set status='success',settled_at=now(),provider_amount=$2 where id=$1", [p.id, o.providerKobo === undefined ? null : o.providerKobo / 100]);
      const amount = Number(p.amount);
      if (p.purpose === 'topup') {
        await postTxn(q, { memberId: p.member_id, type: 'topup', amount, direction: 1, reference: ref, narration: `Deposit via ${p.provider}` });
      } else {
        await postTxn(q, { memberId: p.member_id, type: 'loan_repayment', amount, direction: 1, affectsSavings: false, reference: ref, narration: 'Loan repayment' });
        await applyRepayment(q, p.purpose_ref, amount);
      }
      await notify(q, p.member_id, 'Payment received', `₦${amount.toLocaleString()} received (${ref}).`);
      return { status: 'success' };
    });
  }
  verifySignature(provider: Provider, raw: Buffer | undefined, sig?: string) {
    const c = config();
    const secret = provider === 'paystack' ? c.paystackWebhookSecret : c.flutterwaveWebhookSecret;
    if (!signatureValid(provider, secret, raw, sig)) throw new UnauthorizedException();
  }
}
@Controller()
export class SavingsController {
  constructor(private s: SavingsService) {}
  @Get('savings') wallet(@CurrentUser() u: AuthUser) { return this.s.wallet(u); }
  @Put('savings/target') target(@CurrentUser() u: AuthUser, @Body() d: TargetDto) { return this.s.setTarget(u, d); }
  @Get('savings/transactions') tx(@CurrentUser() u: AuthUser, @Query('limit') l?: string) { return this.s.history(u, Number(l) || 50); }
  @Get('payments/mine') pays(@CurrentUser() u: AuthUser) { return this.s.myPayments(u); }
  @Post('savings/withdraw') wd(@CurrentUser() u: AuthUser, @Body() d: AmountDto) { return this.s.withdraw(u, d); }
  @Post('payments/initiate') init(@CurrentUser() u: AuthUser, @Body() d: PayInitDto) { return this.s.initiate(u, d); }
  /** Dev-only helper so the flow is testable without live gateway credentials. Members can only settle their own payments. */
  @Post('payments/:ref/simulate') sim(@Param('ref') ref: string, @CurrentUser() u: AuthUser) {
    if (config().env === 'production' || config().env === 'staging') throw new ForbiddenException();
    return this.s.settle(ref, true, { memberId: u.memberId ?? undefined });
  }
  @Public() @Post('payments/webhook/:provider')
  async hook(@Param('provider') p: string, @Req() req: RawBodyRequest<any>, @Headers('x-paystack-signature') s1?: string, @Headers('verif-hash') s2?: string) {
    if (!PROVIDERS.includes(p as Provider)) throw new BadRequestException();
    const provider = p as Provider;
    this.s.verifySignature(provider, req.rawBody, provider === 'paystack' ? s1 : s2);
    const data = req.body?.data;
    const ref = data?.reference ?? data?.tx_ref;
    if (typeof ref !== 'string' || !ref) throw new BadRequestException('Missing reference');
    const providerKobo = toKobo(provider, data?.amount);
    const success = data?.status === 'success';
    if (success && providerKobo === undefined) throw new BadRequestException('Missing amount');
    return this.s.settle(ref, success, { provider, providerKobo });
  }
}
@Module({ providers: [SavingsService], controllers: [SavingsController], exports: [SavingsService] }) export class SavingsModule {}
