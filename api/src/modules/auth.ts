import { BadRequestException, Body, Controller, Get, Injectable, Module, Post, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import { Db } from '../common/db';
import { AuthUser, CurrentUser, Public } from '../common/auth';
import { LoginDto, RegisterDto } from '../common/dto';

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
  async login(d: LoginDto) {
    const u = await this.db.one('select * from users where email=$1', [d.email.toLowerCase()]);
    // Same error for unknown user / bad password to avoid account enumeration.
    if (!u || !u.is_active || !(await bcrypt.compare(d.password, u.password_hash))) throw new UnauthorizedException('Invalid credentials');
    if (u.totp_enabled) {
      if (!d.code) return { twoFactorRequired: true };
      if (!authenticator.check(d.code, u.totp_secret)) throw new UnauthorizedException('Invalid 2FA code');
    }
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
  @Public() @Post('login') login(@Body() d: LoginDto) { return this.s.login(d); }
  @Get('me') me(@CurrentUser() u: AuthUser) { return this.s.me(u); }
  @Post('2fa/setup') setup(@CurrentUser() u: AuthUser) { return this.s.setup2fa(u); }
  @Post('2fa/enable') enable(@CurrentUser() u: AuthUser, @Body('code') code: string) { return this.s.enable2fa(u, code); }
}
@Module({ providers: [AuthService], controllers: [AuthController] }) export class AuthModule {}
