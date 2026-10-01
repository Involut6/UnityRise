import { CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Db } from './db';

export type Role = 'member' | 'loan_officer' | 'accountant' | 'admin' | 'super_admin';
export interface AuthUser { id: string; role: Role; memberId: string | null }

export const Public = () => SetMetadata('public', true);
export const Roles = (...r: Role[]) => SetMetadata('roles', r);
export const STAFF: Role[] = ['loan_officer', 'accountant', 'admin', 'super_admin'];
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);

/** Global guard: verifies the JWT (unless @Public) then enforces @Roles. super_admin passes every role check. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector, private db: Db) {}
  async canActivate(ctx: ExecutionContext) {
    const h = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>('public', h)) return true;
    const req = ctx.switchToHttp().getRequest();
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (!token) throw new UnauthorizedException();
    let p: any;
    try { p = await this.jwt.verifyAsync(token); } catch { throw new UnauthorizedException(); }
    // Re-check against DB so deactivation / role changes take effect immediately.
    const u = await this.db.one('select u.id,u.role,u.is_active,m.id member_id from users u left join members m on m.user_id=u.id where u.id=$1', [p.sub]);
    if (!u || !u.is_active) throw new UnauthorizedException();
    req.user = { id: u.id, role: u.role, memberId: u.member_id } as AuthUser;
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', h);
    if (roles && u.role !== 'super_admin' && !roles.includes(u.role)) throw new ForbiddenException();
    return true;
  }
}
