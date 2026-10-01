import { Controller, Get, Headers, Module, NotFoundException, Res, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { Db } from '../common/db.js';
import { Public } from '../common/auth.js';
import { LoansModule, LoansService } from './loans.js';

/** Maps a database error to advice a person can act on. */
function dbProblem(e: unknown): string {
  const c = String((e as any)?.code ?? ''); const m = String((e as any)?.message ?? '');
  if (c === '28P01' || c === '28000' || /password authentication|authentication failed/i.test(m)) return 'The database rejected the login. Check the username/password in DATABASE_URL (the Neon password may have been rotated).';
  if (c === '3D000') return 'The database named in DATABASE_URL does not exist.';
  if (/ENOTFOUND|EAI_AGAIN/.test(c + m)) return 'The database host in DATABASE_URL cannot be found. Check for typos.';
  if (/ECONNREFUSED|ETIMEDOUT|timeout|terminated/i.test(c + m)) return 'The database did not answer (timeout/refused). Check DATABASE_URL, and that the Neon project is not suspended.';
  if (/SSL|certificate/i.test(m)) return 'SSL problem connecting to the database. Use the Neon connection string with sslmode=require.';
  return 'Could not query the database. See the function logs in Vercel for details.';
}

const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

@Controller()
export class OpsController {
  constructor(private db: Db, private loans: LoansService) {}
  /**
   * Liveness + database check (use for uptime monitors and to verify a new deployment).
   * On failure it says, in words, what is wrong. It never reveals hosts, usernames or passwords.
   */
  @Public() @Get('health')
  async health(@Res({ passthrough: true }) res: Response) {
    try { await this.db.q('select 1'); }
    catch (e) { res.status(503); return { ok: false, database: 'unreachable', problem: dbProblem(e) }; }
    try { await this.db.q('select 1 from users limit 1'); }
    catch { res.status(503); return { ok: false, database: 'connected', problem: 'Connected, but the tables are missing. Run `npm run migrate` (then `npm run seed`) against THIS database.' }; }
    const m = await this.db.one('select count(*)::int n, max(name) latest from _migrations').catch(() => undefined);
    return { ok: true, database: 'connected', migrations: m?.n ?? null, latestMigration: m?.latest ?? null, time: new Date().toISOString() };
  }

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
