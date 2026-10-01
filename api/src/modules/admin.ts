import { BadRequestException, Body, Controller, Get, Module, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { Db } from '../common/db';
import { AuthUser, CurrentUser, Roles } from '../common/auth';

class RoleDto { @IsIn(['member', 'loan_manager', 'accountant', 'admin']) role: string }

@Controller('admin')
export class AdminController {
  constructor(private db: Db) {}
  @Roles('admin') @Get('audit') audit(@Query('limit') l?: string) {
    return this.db.q(`select a.*,u.email actor from audit_logs a left join users u on u.id=a.actor_id order by a.id desc limit $1`, [Math.min(Number(l) || 100, 500)]);
  }
  @Roles('admin', 'accountant') @Get('transactions')
  txns(@Query('q') q?: string, @Query('type') type?: string, @Query('limit') l?: string) {
    return this.db.q(`select t.id,t.created_at,t.type,t.direction,t.amount,t.reference,t.narration,m.first_name||' '||m.last_name member,m.membership_id
      from transactions t join members m on m.id=t.member_id where ($1::text is null or t.type::text=$1)
      and ($2::text is null or (m.first_name||' '||m.last_name||' '||coalesce(m.membership_id,'')||' '||coalesce(t.reference,'')) ilike '%'||$2||'%')
      order by t.created_at desc limit $3`, [type || null, q || null, Math.min(Number(l) || 300, 1000)]);
  }
  @Roles('admin', 'accountant') @Get('payments')
  pays(@Query('status') s?: string) {
    return this.db.q(`select p.id,p.provider,p.reference,p.purpose,p.amount,p.status,p.created_at,p.settled_at,m.first_name||' '||m.last_name member,m.membership_id
      from payments p join members m on m.id=p.member_id where ($1::text is null or p.status=$1) order by p.created_at desc limit 500`, [s || null]);
  }
  @Roles('admin') @Get('documents')
  docs() {
    return this.db.q(`select d.id,d.kind,d.filename,d.created_at,d.member_id,m.first_name||' '||m.last_name member,m.membership_id from kyc_documents d join members m on m.id=d.member_id order by d.created_at desc limit 500`);
  }
  @Roles('admin') @Get('settings') settings() { return this.db.q('select * from loan_products order by code'); }
  @Roles('super_admin') @Put('users/:id/active')
  async active(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: { active: boolean }) {
    if (id === me.id) throw new BadRequestException('You cannot deactivate yourself');
    await this.db.q("update users set is_active=$2 where id=$1 and role<>'super_admin'", [id, !!d.active]);
    return { ok: true };
  }
  @Roles('super_admin') @Get('users') users(@Query('q') q?: string) { return this.db.q("select id,email,role,is_active,created_at from users where ($1::text is null or email ilike '%'||$1||'%') order by created_at desc limit 200", [q || null]); }
  @Roles('super_admin') @Put('users/:id/role')
  async role(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() d: RoleDto) {
    if (id === me.id) throw new BadRequestException('You cannot change your own role');
    await this.db.q("update users set role=$2 where id=$1 and role<>'super_admin'", [id, d.role]);
    return { ok: true };
  }
}
@Module({ controllers: [AdminController] }) export class AdminModule {}
