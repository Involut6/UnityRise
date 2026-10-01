import { BadRequestException, Ip, Body, Controller, Get, Injectable, Module, Post, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { config } from '../common/config';
import { Db } from '../common/db';
import { AuthUser, CurrentUser, Public } from '../common/auth';
import { LoginDto, RegisterDto } from '../common/dto';

// Valid bcrypt hash of a random string; compared against when the user is unknown so response time doesn't reveal account existence.
const DUMMY_HASH = bcrypt.hashSync(Math.random().toString(36), 12);

@Injectable()
export class AuthService {
  constructor(private db: Db, private jwt: JwtService) {}
  async register(d: RegisterDto) {
    const hash = await bcrypt.hash(d.password, 12);
    try {
      return await this.db.tx(async q => {
        const [u] = await q("insert into users(email,phone,password_hash) values($1,$2,$3) returning id", [d.email.toLowerCase(), d.phone, hash]);
        await q('insert into members(user_id,first_name,last_name) values($1,$2,$3)', [u.id, d.firstName, d.lastName]);
        return { token: await this.jwt.signAsync({ sub: u.id }) };
      });
    } catch (e: any) { if (e.code === '23505') throw new ConflictException('Email or phone already registered'); throw e; }
  }
  private audit(actor: string, action: string, ip?: string) {
    return this.db.q('insert into audit_logs(actor_id,action,ip) values($1,$2,$3)', [actor, action, ip ?? null]);
  }
  /** Atomically count a failure and lock the account once the threshold is hit. */
  private async recordFailure(id: string, ip?: string) {
    const { maxFailures, lockMinutes } = config().login;
    const [u] = await this.db.q(`update users set failed_logins=failed_logins+1,
      locked_until=case when failed_logins+1>=$2 then now()+make_interval(mins=>$3) else locked_until end
      where id=$1 returning failed_logins`, [id, maxFailures, lockMinutes]);
    await this.audit(id, u.failed_logins >= maxFailures ? 'auth.login.locked_out' : 'auth.login.failed', ip);
  }
  async login(d: LoginDto, ip?: string) {
    const u = await this.db.one('select * from users where email=$1', [d.email.toLowerCase()]);
    // Same error for unknown user / bad password / locked account to avoid account enumeration.
    const invalid = new UnauthorizedException('Invalid credentials');
    if (!u || !u.is_active) { await bcrypt.compare(d.password, DUMMY_HASH); throw invalid; } // equalise timing
    if (u.locked_until && new Date(u.locked_until) > new Date()) { await this.audit(u.id, 'auth.login.locked', ip); throw invalid; }
    const ok = await bcrypt.compare(d.password, u.password_hash);
    if (!ok) { await this.recordFailure(u.id, ip); throw invalid; }
    if (u.totp_enabled) {
      if (!d.code) return { twoFactorRequired: true };
      if (!authenticator.check(d.code, u.totp_secret)) { await this.recordFailure(u.id, ip); throw new UnauthorizedException('Invalid 2FA code'); }
    }
    await this.db.q('update users set failed_logins=0,locked_until=null where id=$1', [u.id]);
    await this.audit(u.id, 'auth.login.success', ip);
    return { token: await this.jwt.signAsync({ sub: u.id }) };
  }
  async me(u: AuthUser) {
    return this.db.one(`select u.id,u.email,u.phone,u.role,u.totp_enabled,m.id member_id,m.membership_id,m.first_name,m.last_name,m.kyc_status
      from users u left join members m on m.user_id=u.id where u.id=$1`, [u.id]);
  }
  async setup2fa(u: AuthUser) {
    const secret = authenticator.generateSecret();
    await this.db.q('update users set totp_secret=$2,totp_enabled=false where id=$1', [u.id, secret]);
    const user = await this.db.one('select email from users where id=$1', [u.id]);
    return { secret, otpauthUrl: authenticator.keyuri(user.email, 'UnityRise', secret) };
  }
  async enable2fa(u: AuthUser, code: string) {
    const r = await this.db.one('select totp_secret from users where id=$1', [u.id]);
    if (!r.totp_secret || !authenticator.check(code, r.totp_secret)) throw new BadRequestException('Invalid code');
    await this.db.q('update users set totp_enabled=true where id=$1', [u.id]);
    return { enabled: true };
  }
}

@Controller('auth')
export class AuthController {
  constructor(private s: AuthService) {}
  @Public() @Post('register') register(@Body() d: RegisterDto) { return this.s.register(d); }
  @Public() @Post('login') login(@Body() d: LoginDto, @Ip() ip: string) { return this.s.login(d, ip); }
  @Get('me') me(@CurrentUser() u: AuthUser) { return this.s.me(u); }
  @Post('2fa/setup') setup(@CurrentUser() u: AuthUser) { return this.s.setup2fa(u); }
  @Post('2fa/enable') enable(@CurrentUser() u: AuthUser, @Body('code') code: string) { return this.s.enable2fa(u, code); }
}
@Module({ providers: [AuthService], controllers: [AuthController] }) export class AuthModule {}
