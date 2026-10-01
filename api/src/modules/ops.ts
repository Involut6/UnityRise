import { Controller, Get, Headers, Module, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { Db } from '../common/db.js';
import { Public } from '../common/auth.js';
import { LoansModule, LoansService } from './loans.js';

const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

@Controller()
export class OpsController {
  constructor(private db: Db, private loans: LoansService) {}
  /** Liveness + database check (use for uptime monitors and to verify a new deployment). */
  @Public() @Get('health')
  async health() { await this.db.q('select 1'); return { ok: true, time: new Date().toISOString() }; }

  /**
   * Daily housekeeping: late-payment penalties and repayment reminders.
   * Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`. Disabled (404) until CRON_SECRET is set.
   */
  @Public() @Get('cron/daily')
  async daily(@Headers('authorization') auth?: string) {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new NotFoundException();
    if (!auth || !same(auth, `Bearer ${secret}`)) throw new UnauthorizedException();
    return { penalties: await this.loans.runPenalties(), reminders: await this.loans.runReminders() };
  }
}
@Module({ imports: [LoansModule], controllers: [OpsController] }) export class OpsModule {}
